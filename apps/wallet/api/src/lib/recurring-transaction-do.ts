import { createWalletClient, http, type Address, type Hex } from 'viem';
import { Account, Actions, Abis } from 'viem/tempo';
import { createTempoPublicClient } from './viem';
import { getTempoChain, getRpcUrl } from './chain';
import { decryptAccessKey, type EncryptedKey } from './key-vault';
import type { Env } from '../types/env';

const MAX_CONSECUTIVE_FAILURES = 5;
const TRANSIENT_RETRY_BASE_MS = 30_000;
const MAX_TRANSIENT_RETRIES_PER_RUN = 3;

interface InitPayload {
  recurringId: string;
  encryptedKey: EncryptedKey;
  signatureType: 'secp256k1' | 'p256';
  owner: Address;
  to: Address;
  token: Address;
  amount: string;
  feeToken: Address;
  network: string;
  intervalSeconds: number;
  startAt: number; // ms
  endAt?: number; // ms
  maxExecutions?: number;
  memo?: string;
}

interface DOState extends InitPayload {
  // mutable
  transientRetries: number;
}

const ALARM_PAUSED_SENTINEL = Number.MAX_SAFE_INTEGER;

/**
 * Owns the lifecycle of a single recurring transaction. Stores the encrypted
 * access-key private key in DO storage; signs and broadcasts each recurrence
 * at alarm time. The on-chain access key (with its spending limits + allowed
 * calls) is the safety boundary — even if this DO is fully compromised, it
 * can only execute the recurrence the user already authorized.
 */
export class RecurringTransactionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      const payload = (await request.json()) as InitPayload;
      await this.state.storage.put({ ...payload, transientRetries: 0 });
      await this.state.storage.setAlarm(payload.startAt);
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/pause' && request.method === 'POST') {
      await this.state.storage.deleteAlarm();
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/resume' && request.method === 'POST') {
      const next = await this.state.storage.get<number>('nextRunAtMs');
      if (typeof next === 'number' && next < ALARM_PAUSED_SENTINEL) {
        await this.state.storage.setAlarm(Math.max(next, Date.now() + 1000));
      } else {
        const payload = await this.loadAll();
        if (payload) {
          await this.state.storage.setAlarm(Math.max(payload.startAt, Date.now() + 1000));
        }
      }
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/cancel' && request.method === 'POST') {
      await this.state.storage.deleteAlarm();
      await this.state.storage.deleteAll();
      return new Response('OK', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm(): Promise<void> {
    const payload = await this.loadAll();
    if (!payload) return;

    // 1. Status check from D1 (paused / cancelled / completed)
    const row = await this.fetchD1Row(payload.recurringId);
    if (!row) {
      await this.state.storage.deleteAll();
      return;
    }
    if (row.status !== 'active') {
      // Paused / cancelled / completed / failed — drop the alarm.
      return;
    }

    // 2. End-condition checks
    const now = Date.now();
    if (payload.endAt && now > payload.endAt) {
      await this.markCompleted(payload.recurringId);
      await this.state.storage.deleteAll();
      return;
    }
    if (
      typeof payload.maxExecutions === 'number' &&
      row.executions_completed >= payload.maxExecutions
    ) {
      await this.markCompleted(payload.recurringId);
      await this.state.storage.deleteAll();
      return;
    }

    // 3. On-chain access key freshness
    try {
      const chain = getTempoChain(payload.network);
      const rpcUrl = getRpcUrl(chain);
      const publicClient = createTempoPublicClient(rpcUrl, chain);
      const meta = await Actions.accessKey.getMetadata(publicClient, {
        account: payload.owner,
        accessKey: this.accessKeyAddressFromRow(row),
      });
      if (meta.isRevoked) {
        await this.markFailed(payload.recurringId, 'Access key revoked on-chain');
        await this.state.storage.deleteAll();
        return;
      }
      if (meta.expiry && Number(meta.expiry) > 0 && Number(meta.expiry) * 1000 < now) {
        await this.markFailed(payload.recurringId, 'Access key expired on-chain');
        await this.state.storage.deleteAll();
        return;
      }

      // 4. Decrypt + build access-key signing client. Default v2 keychain
      // envelope — testnet rejects v1 with "legacy V1 keychain signature is
      // no longer accepted, use V2 (type 0x04)".
      const privateKey = (await decryptAccessKey(payload.encryptedKey, this.env)) as Hex;
      const accountFn = payload.signatureType === 'p256' ? Account.fromP256 : Account.fromSecp256k1;
      const accessKeyAccount = accountFn(privateKey, { access: payload.owner });

      const walletClient = createWalletClient({
        account: accessKeyAccount,
        chain,
        transport: http(rpcUrl),
      });

      // 5. Send the transfer — call writeContract directly with the standard
      // tip20 ABI so the call path is transparent. The access-key account
      // attached to the wallet client signs the tempo tx envelope.
      console.log('[RecurringTransactionDO] sending transfer', {
        recurringId: payload.recurringId,
        owner: payload.owner,
        accessKeyAddress: (accessKeyAccount as { accessKeyAddress?: string }).accessKeyAddress,
        accountAddress: accessKeyAccount.address,
        token: payload.token,
        to: payload.to,
        amount: payload.amount,
        feeToken: payload.feeToken,
        network: payload.network,
      });
      const txHash = await walletClient.writeContract({
        address: payload.token,
        abi: Abis.tip20,
        functionName: 'transfer',
        args: [payload.to, BigInt(payload.amount)],
        feeToken: payload.feeToken,
      } as never);

      await this.recordSuccess(payload, row.executions_completed + 1, txHash);

      // 6. Schedule next run (or complete)
      const nextRun = now + payload.intervalSeconds * 1000;
      const willExceedRuns =
        typeof payload.maxExecutions === 'number' &&
        row.executions_completed + 1 >= payload.maxExecutions;
      const willExceedEnd = payload.endAt && nextRun > payload.endAt;

      if (willExceedRuns || willExceedEnd) {
        await this.markCompleted(payload.recurringId);
        await this.state.storage.deleteAll();
      } else {
        await this.state.storage.put('nextRunAtMs', nextRun);
        await this.state.storage.put('transientRetries', 0);
        await this.state.storage.setAlarm(nextRun);
      }
    } catch (error) {
      const err = error as Error & {
        cause?: unknown;
        details?: string;
        shortMessage?: string;
        metaMessages?: string[];
      };
      console.error('[RecurringTransactionDO] alarm execution failed', {
        recurringId: payload.recurringId,
        owner: payload.owner,
        accessKeyId: row.access_key_id,
        token: payload.token,
        feeToken: payload.feeToken,
        to: payload.to,
        amount: payload.amount,
        errorName: err.name,
        errorMessage: err.message,
        shortMessage: err.shortMessage,
        details: err.details,
        metaMessages: err.metaMessages,
        cause: err.cause instanceof Error ? `${err.cause.name}: ${err.cause.message}` : err.cause,
      });
      await this.handleAlarmError(payload, row.executions_completed + 1, error);
    }
  }

  // -------------------------------------------------------------------------

  private async loadAll(): Promise<DOState | null> {
    const all = (await this.state.storage.list()) as Map<string, unknown>;
    if (!all.has('recurringId')) return null;
    const obj: Record<string, unknown> = {};
    for (const [k, v] of all) obj[k] = v;
    return obj as unknown as DOState;
  }

  private accessKeyAddressFromRow(row: D1Row): Address {
    return row.access_key_id as Address;
  }

  private async handleAlarmError(
    payload: DOState,
    runNumber: number,
    error: unknown
  ): Promise<void> {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    const classification = classifyError(reason);

    if (classification === 'transient') {
      const retries = (payload.transientRetries ?? 0) + 1;
      if (retries < MAX_TRANSIENT_RETRIES_PER_RUN) {
        await this.state.storage.put('transientRetries', retries);
        const delay = TRANSIENT_RETRY_BASE_MS * 2 ** (retries - 1);
        await this.state.storage.setAlarm(Date.now() + delay);
        return;
      }
      // Exhausted transient retries — treat as a failed run for this period.
    }

    // Record execution row + bump consecutiveFailures
    await this.recordFailure(payload, runNumber, reason, classification);

    const newConsec = await this.bumpAndReadConsecutive(payload.recurringId);
    if (newConsec >= MAX_CONSECUTIVE_FAILURES || classification === 'permanent') {
      await this.markFailed(
        payload.recurringId,
        classification === 'permanent'
          ? reason
          : `Auto-disabled after ${MAX_CONSECUTIVE_FAILURES} consecutive failures (last: ${reason})`
      );
      await this.state.storage.deleteAll();
      return;
    }

    // Skippable / soft fail → advance to next interval and reschedule
    const nextRun = Date.now() + payload.intervalSeconds * 1000;
    await this.state.storage.put('nextRunAtMs', nextRun);
    await this.state.storage.put('transientRetries', 0);
    await this.state.storage.setAlarm(nextRun);
  }

  // ---- D1 helpers ---------------------------------------------------------

  private async fetchD1Row(id: string): Promise<D1Row | null> {
    const result = await this.env.DB.prepare(
      'SELECT * FROM recurring_transactions WHERE id = ? LIMIT 1'
    )
      .bind(id)
      .first<D1Row>();
    return result ?? null;
  }

  private async recordSuccess(payload: DOState, runNumber: number, txHash: string) {
    const now = Math.floor(Date.now() / 1000);
    const execId = crypto.randomUUID();
    await this.env.DB.batch([
      this.env.DB.prepare(
        'INSERT INTO recurring_executions (id, recurring_id, run_number, status, tx_hash, executed_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(execId, payload.recurringId, runNumber, 'success', txHash, now),
      this.env.DB.prepare(
        `UPDATE recurring_transactions
           SET executions_completed = executions_completed + 1,
               consecutive_failures = 0,
               last_run_at = ?,
               last_tx_hash = ?,
               last_fail_reason = NULL,
               next_run_at = ?
         WHERE id = ?`
      ).bind(
        now,
        txHash,
        Math.floor((Date.now() + payload.intervalSeconds * 1000) / 1000),
        payload.recurringId
      ),
    ]);
  }

  private async recordFailure(
    payload: DOState,
    runNumber: number,
    reason: string,
    classification: 'skippable' | 'transient' | 'permanent'
  ) {
    const now = Math.floor(Date.now() / 1000);
    const execId = crypto.randomUUID();
    const status = classification === 'skippable' ? 'skipped' : 'failed';
    await this.env.DB.prepare(
      'INSERT INTO recurring_executions (id, recurring_id, run_number, status, fail_reason, executed_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(execId, payload.recurringId, runNumber, status, truncate(reason, 4000), now)
      .run();
    await this.env.DB.prepare(
      `UPDATE recurring_transactions
         SET last_run_at = ?, last_fail_reason = ?
       WHERE id = ?`
    )
      .bind(now, truncate(reason, 4000), payload.recurringId)
      .run();
  }

  private async bumpAndReadConsecutive(id: string): Promise<number> {
    await this.env.DB.prepare(
      'UPDATE recurring_transactions SET consecutive_failures = consecutive_failures + 1 WHERE id = ?'
    )
      .bind(id)
      .run();
    const row = await this.env.DB.prepare(
      'SELECT consecutive_failures FROM recurring_transactions WHERE id = ?'
    )
      .bind(id)
      .first<{ consecutive_failures: number }>();
    return row?.consecutive_failures ?? 0;
  }

  private async markCompleted(id: string) {
    await this.env.DB.prepare("UPDATE recurring_transactions SET status = 'completed' WHERE id = ?")
      .bind(id)
      .run();
  }

  private async markFailed(id: string, reason: string) {
    await this.env.DB.prepare(
      "UPDATE recurring_transactions SET status = 'failed', last_fail_reason = ? WHERE id = ?"
    )
      .bind(truncate(reason, 4000), id)
      .run();
  }
}

interface D1Row {
  id: string;
  access_key_id: string;
  status: string;
  executions_completed: number;
}

function classifyError(reason: string): 'skippable' | 'transient' | 'permanent' {
  const r = reason.toLowerCase();
  if (
    r.includes('insufficient') ||
    r.includes('balance') ||
    r.includes('allowance') ||
    r.includes('limit') ||
    r.includes('exceeds')
  ) {
    return 'skippable';
  }
  if (
    r.includes('revoked') ||
    r.includes('expired') ||
    r.includes('unauthorized') ||
    r.includes('not authorized')
  ) {
    return 'permanent';
  }
  return 'transient';
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}
