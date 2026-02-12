import { createTempoPublicClient } from './viem';
import { getTempoChain, getRpcUrl } from './chain';
import type { Env } from '../types/env';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30_000; // 30 seconds between retries

interface ScheduledTxPayload {
  txId: string;
  serializedTx: string;
  network: string;
  scheduledFor: number; // Unix timestamp in ms
}

/**
 * Durable Object that owns the lifecycle of a single scheduled transaction.
 *
 * Flow:
 *  1. Worker route creates the DO and calls /schedule via fetch
 *  2. DO stores payload in its own storage and sets an alarm for scheduledFor
 *  3. Alarm fires at the exact time → DO submits the raw tx to the blockchain
 *  4. On success → updates D1 (status=executed, txHash)
 *  5. On failure → retries up to MAX_ATTEMPTS, then updates D1 (status=failed)
 *  6. Cleans up its own storage after completion
 */
export class ScheduledTransactionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/schedule' && request.method === 'POST') {
      const payload: ScheduledTxPayload = await request.json();

      // Store everything the alarm needs in DO storage
      await this.state.storage.put({
        txId: payload.txId,
        serializedTx: payload.serializedTx,
        network: payload.network,
        attempts: 0,
      });

      // Set alarm for the exact scheduled time
      await this.state.storage.setAlarm(payload.scheduledFor);

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
    const txId = await this.state.storage.get<string>('txId');
    const serializedTx = await this.state.storage.get<string>('serializedTx');
    const network = await this.state.storage.get<string>('network');
    const attempts = (await this.state.storage.get<number>('attempts')) ?? 0;

    if (!txId || !serializedTx || !network) {
      // Storage was cleaned up (cancelled) — nothing to do
      return;
    }

    const nextAttempt = attempts + 1;
    await this.state.storage.put('attempts', nextAttempt);

    try {
      const chain = getTempoChain(network);
      const rpcUrl = getRpcUrl(chain);
      const publicClient = createTempoPublicClient(rpcUrl, chain);

      const txHash = await publicClient.sendRawTransaction({
        serializedTransaction: serializedTx as `0x${string}`,
      });

      // Success — update D1 and clean up DO storage
      await this.updateD1Status(txId, 'executed', nextAttempt, txHash);
      await this.state.storage.deleteAll();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';

      if (nextAttempt >= MAX_ATTEMPTS) {
        // Exhausted retries — mark as permanently failed
        await this.updateD1Status(txId, 'failed', nextAttempt, undefined, reason);
        await this.state.storage.deleteAll();
      } else {
        // Schedule retry
        await this.state.storage.setAlarm(Date.now() + RETRY_DELAY_MS);
      }
    }
  }

  private async updateD1Status(
    txId: string,
    status: 'executed' | 'failed',
    attempts: number,
    txHash?: string,
    failReason?: string,
  ): Promise<void> {
    const db = this.env.DB;

    if (status === 'executed' && txHash) {
      await db
        .prepare(
          'UPDATE scheduled_transactions SET status = ?, tx_hash = ?, attempts = ?, executed_at = ? WHERE id = ?'
        )
        .bind(status, txHash, attempts, Math.floor(Date.now() / 1000), txId)
        .run();
    } else if (status === 'failed') {
      await db
        .prepare(
          'UPDATE scheduled_transactions SET status = ?, attempts = ?, fail_reason = ? WHERE id = ?'
        )
        .bind(status, attempts, failReason ?? 'Unknown error', txId)
        .run();
    }
  }
}
