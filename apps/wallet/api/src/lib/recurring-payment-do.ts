import { createTempoPublicClient, createTempoWalletClient } from './viem';
import { getTempoChain, getRpcUrl } from './chain';
import { createId } from '@paralleldrive/cuid2';
import { privateKeyToAccount } from 'viem/accounts';
import { randomNonceKey } from './nonce';
import type { Env } from '../types/env';

const MAX_RETRIES_PER_INTERVAL = 3;
const RETRY_DELAY_MS = 15_000;
const MAX_CONSECUTIVE_FAILED_INTERVALS = 10;

// Errors that won't resolve within the same interval — skip immediately
const SKIP_TO_NEXT_PATTERNS = [
  'insufficient balance',
  'insufficient allowance',
  'transfer failed',
  'max payments reached',
  'subscription inactive',
  'ERC20: transfer amount exceeds balance',
  'ERC20: insufficient allowance',
];

function isSkippableError(message: string): boolean {
  const lower = message.toLowerCase();
  return SKIP_TO_NEXT_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

const EXECUTE_PAYMENT_ABI = [
  {
    type: 'function',
    name: 'executePayment',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isDue',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSubscription',
    inputs: [{ name: 'subscriptionId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'subscriber', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'interval', type: 'uint256' },
          { name: 'nextPayment', type: 'uint256' },
          { name: 'maxPayments', type: 'uint256' },
          { name: 'paymentsMade', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const;

interface RecurringPaymentPayload {
  recordId: string;
  subscriptionId: number;
  contractAddress: string;
  network: string;
  intervalMs: number;
  nextPaymentAt: number;
}

type OnChainSub = {
  active: boolean;
  nextPayment: bigint;
  paymentsMade: bigint;
  maxPayments: bigint;
  amount: bigint;
};

/**
 * Durable Object that manages the lifecycle of a single recurring payment.
 *
 * Error handling strategy:
 *   - Skippable errors (no balance, no allowance) → skip to next interval immediately.
 *     These won't resolve in 30 seconds, so retrying wastes relayer resources
 *     and can cause nonce conflicts with other DOs sharing the relayer.
 *   - Transient errors (RPC timeout, nonce error) → retry within same interval.
 *   - After MAX_CONSECUTIVE_FAILED_INTERVALS → permanently fail.
 *   - Any success resets all failure counters.
 */
export class RecurringPaymentDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/schedule' && request.method === 'POST') {
      const payload: RecurringPaymentPayload = await request.json();

      await this.state.storage.put({
        recordId: payload.recordId,
        subscriptionId: payload.subscriptionId,
        contractAddress: payload.contractAddress,
        network: payload.network,
        intervalMs: payload.intervalMs,
        retries: 0,
        failedIntervals: 0,
        lastFailReason: '',
      });

      await this.state.storage.setAlarm(payload.nextPaymentAt);
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
    const recordId = await this.state.storage.get<string>('recordId');
    const subscriptionId = await this.state.storage.get<number>('subscriptionId');
    const contractAddress = await this.state.storage.get<string>('contractAddress');
    const network = await this.state.storage.get<string>('network');
    const intervalMs = await this.state.storage.get<number>('intervalMs');
    const retries = (await this.state.storage.get<number>('retries')) ?? 0;
    const failedIntervals = (await this.state.storage.get<number>('failedIntervals')) ?? 0;

    if (
      !recordId ||
      subscriptionId === null ||
      subscriptionId === undefined ||
      !contractAddress ||
      !network ||
      !intervalMs
    ) {
      return;
    }

    try {
      const chain = getTempoChain(network);
      const rpcUrl = getRpcUrl(chain);
      const publicClient = createTempoPublicClient(rpcUrl, chain);
      const addr = contractAddress as `0x${string}`;

      // 1. Check if payment is due on-chain
      const isDue = await publicClient.readContract({
        address: addr,
        abi: EXECUTE_PAYMENT_ABI,
        functionName: 'isDue',
        args: [BigInt(subscriptionId)],
      });

      if (!isDue) {
        await this.syncWithChain(publicClient, addr, subscriptionId, recordId);
        return;
      }

      // 2. Simulate with public client FIRST (free eth_call, no nonce, no relayer)
      //    This catches user errors (no balance, no allowance) without touching the relayer
      const relayerKey =
        network === 'testnet'
          ? this.env.TESTNET_RELAYER_PRIVATE_KEY
          : this.env.MAINNET_RELAYER_PRIVATE_KEY;

      const relayerAccount = privateKeyToAccount(relayerKey as `0x${string}`);

      try {
        await publicClient.simulateContract({
          address: addr,
          abi: EXECUTE_PAYMENT_ABI,
          functionName: 'executePayment',
          args: [BigInt(subscriptionId)],
          account: relayerAccount,
        });
      } catch (simError) {
        // Simulation failed — this is a user error (no balance, no allowance, etc.)
        // Skip to next interval immediately — don't waste relayer nonces
        const reason = simError instanceof Error ? simError.message : 'Simulation failed';
        await this.handleSkippableError(recordId, reason, failedIntervals, intervalMs);
        return;
      }

      // 3. Simulation passed — safe to send via relayer
      const walletClient = createTempoWalletClient(rpcUrl, relayerKey, chain);
      const MAX_CATCHUP = 50;

      for (let i = 0; i < MAX_CATCHUP; i++) {
        if (i > 0) {
          const stillDue = await publicClient.readContract({
            address: addr,
            abi: EXECUTE_PAYMENT_ABI,
            functionName: 'isDue',
            args: [BigInt(subscriptionId)],
          });
          if (!stillDue) break;

          // Re-simulate before each catch-up tx
          try {
            await publicClient.simulateContract({
              address: addr,
              abi: EXECUTE_PAYMENT_ABI,
              functionName: 'executePayment',
              args: [BigInt(subscriptionId)],
              account: relayerAccount,
            });
          } catch {
            // Can't execute more — user ran out of balance mid-catchup
            break;
          }
        }

        const txHash = await walletClient.writeContract({
          chain,
          account: walletClient.account!,
          address: addr,
          abi: EXECUTE_PAYMENT_ABI,
          functionName: 'executePayment',
          args: [BigInt(subscriptionId)],
          nonceKey: randomNonceKey(),
          nonce: 0,
        } as any);

        await publicClient.waitForTransactionReceipt({ hash: txHash });

        const sub = (await publicClient.readContract({
          address: addr,
          abi: EXECUTE_PAYMENT_ABI,
          functionName: 'getSubscription',
          args: [BigInt(subscriptionId)],
        })) as OnChainSub;

        const paymentsMade = Number(sub.paymentsMade);
        const amount = sub.amount.toString();
        const nextPaymentUnix = Number(sub.nextPayment);

        if (!sub.active) {
          await this.updateD1Payment(recordId, 'completed', paymentsMade, txHash, amount);
          await this.state.storage.deleteAll();
          return;
        }

        await this.updateD1Payment(
          recordId,
          'active',
          paymentsMade,
          txHash,
          amount,
          nextPaymentUnix
        );

        // Success — reset all failure counters
        await this.state.storage.put({ retries: 0, failedIntervals: 0, lastFailReason: '' });

        if (nextPaymentUnix > Math.floor(Date.now() / 1000)) {
          await this.state.storage.setAlarm(nextPaymentUnix * 1000);
          return;
        }
      }

      // Hit MAX_CATCHUP — continue on next alarm
      await this.state.storage.setAlarm(Date.now() + 1000);
    } catch (error) {
      // Relayer/network error (nonce conflict, RPC timeout, etc.)
      const reason = error instanceof Error ? error.message : 'Unknown error';

      if (isSkippableError(reason)) {
        await this.handleSkippableError(recordId, reason, failedIntervals, intervalMs);
        return;
      }

      // Transient error — retry within this interval
      const nextRetry = retries + 1;
      await this.state.storage.put({ retries: nextRetry, lastFailReason: reason });

      if (nextRetry < MAX_RETRIES_PER_INTERVAL) {
        await this.updateD1Status(
          recordId,
          'active',
          `Retrying (${nextRetry}/${MAX_RETRIES_PER_INTERVAL}): ${reason}`
        );
        await this.state.storage.setAlarm(Date.now() + RETRY_DELAY_MS);
      } else {
        // All retries exhausted for transient error — skip to next interval
        await this.handleSkippableError(recordId, reason, failedIntervals, intervalMs);
      }
    }
  }

  /**
   * Handle an error by skipping to the next interval.
   * Increments failedIntervals counter. Permanently fails after MAX_CONSECUTIVE_FAILED_INTERVALS.
   */
  private async handleSkippableError(
    recordId: string,
    reason: string,
    failedIntervals: number,
    intervalMs: number
  ): Promise<void> {
    const nextFailedIntervals = failedIntervals + 1;
    await this.state.storage.put({
      retries: 0,
      failedIntervals: nextFailedIntervals,
      lastFailReason: reason,
    });

    if (nextFailedIntervals >= MAX_CONSECUTIVE_FAILED_INTERVALS) {
      await this.updateD1Failed(
        recordId,
        `Failed ${MAX_CONSECUTIVE_FAILED_INTERVALS} consecutive intervals. Last error: ${reason}`
      );
      await this.state.storage.deleteAll();
    } else {
      await this.updateD1Status(
        recordId,
        'active',
        `Skipped interval ${nextFailedIntervals}/${MAX_CONSECUTIVE_FAILED_INTERVALS}: ${reason}`
      );
      await this.state.storage.setAlarm(Date.now() + intervalMs);
    }
  }

  /**
   * Sync D1 with on-chain state when isDue() returns false.
   */
  private async syncWithChain(
    publicClient: ReturnType<typeof createTempoPublicClient>,
    contractAddress: `0x${string}`,
    subscriptionId: number,
    recordId: string
  ): Promise<void> {
    const sub = (await publicClient.readContract({
      address: contractAddress,
      abi: EXECUTE_PAYMENT_ABI,
      functionName: 'getSubscription',
      args: [BigInt(subscriptionId)],
    })) as OnChainSub;

    const onChainPayments = Number(sub.paymentsMade);

    // Backfill missing execution records
    const d1Result = await this.env.DB.prepare(
      'SELECT payments_made FROM recurring_payments WHERE id = ?'
    )
      .bind(recordId)
      .first<{ payments_made: number }>();

    const d1Payments = d1Result?.payments_made ?? 0;

    if (onChainPayments > d1Payments) {
      const amount = sub.amount.toString();
      const now = Math.floor(Date.now() / 1000);
      for (let i = d1Payments + 1; i <= onChainPayments; i++) {
        await this.env.DB.prepare(
          'INSERT INTO recurring_payment_executions (id, recurring_payment_id, payment_number, tx_hash, amount, status, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
          .bind(createId(), recordId, i, 'synced-from-chain', amount, 'confirmed', now)
          .run();
      }
    }

    if (!sub.active) {
      await this.updateD1Completed(recordId, onChainPayments);
      await this.state.storage.deleteAll();
      return;
    }

    const nextPaymentUnix = Number(sub.nextPayment);
    await this.env.DB.prepare(
      'UPDATE recurring_payments SET payments_made = ?, next_payment_at = ?, status = ?, fail_reason = NULL WHERE id = ?'
    )
      .bind(onChainPayments, nextPaymentUnix, 'active', recordId)
      .run();

    await this.state.storage.put({ retries: 0, failedIntervals: 0, lastFailReason: '' });
    await this.state.storage.setAlarm(nextPaymentUnix * 1000);
  }

  // ── D1 helpers ───────────────────────────────────────────────

  private async updateD1Payment(
    recordId: string,
    status: 'active' | 'completed',
    paymentsMade: number,
    txHash: string,
    amount: string,
    nextPaymentUnix?: number
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const nextPaymentAt = nextPaymentUnix ?? now;

    await this.env.DB.prepare(
      'UPDATE recurring_payments SET status = ?, payments_made = ?, last_paid_at = ?, tx_hash = ?, next_payment_at = ?, fail_reason = NULL WHERE id = ?'
    )
      .bind(status, paymentsMade, now, txHash, nextPaymentAt, recordId)
      .run();

    await this.env.DB.prepare(
      'INSERT INTO recurring_payment_executions (id, recurring_payment_id, payment_number, tx_hash, amount, status, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(createId(), recordId, paymentsMade, txHash, amount, 'confirmed', now)
      .run();
  }

  private async updateD1Status(
    recordId: string,
    status: string,
    failReason: string
  ): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE recurring_payments SET status = ?, fail_reason = ? WHERE id = ?'
    )
      .bind(status, failReason, recordId)
      .run();
  }

  private async updateD1Failed(recordId: string, reason: string): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE recurring_payments SET status = ?, fail_reason = ? WHERE id = ?'
    )
      .bind('failed', reason, recordId)
      .run();
  }

  private async updateD1Completed(recordId: string, paymentsMade: number): Promise<void> {
    await this.env.DB.prepare(
      'UPDATE recurring_payments SET status = ?, payments_made = ? WHERE id = ?'
    )
      .bind('completed', paymentsMade, recordId)
      .run();
  }
}
