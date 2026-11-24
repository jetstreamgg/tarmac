import { TransactionReceiptNotFoundError, type Hex, type Log } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { DAY_MINUTES, nativeWithdrawalRoute } from '../../model/resolveRoute';
import type { ChainReader } from '../types';
import { BASE_BURN_LOGS } from '../cctp/cctp.fixtures';
import { arbitrumWithdrawalMessage } from './arbitrum';
import { lookupNativeWithdrawal } from './lookup';
import { opStackWithdrawalMessage } from './opStack';
import {
  ARBITRUM_WITHDRAWAL_LOGS,
  ARBITRUM_WITHDRAWAL_TX,
  BASE_WITHDRAWAL_LOGS,
  BASE_WITHDRAWAL_TX,
  OPTIMISM_WITHDRAWAL_LOGS
} from './withdrawalFixtures';

const OTHER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const BLOCK_SECONDS = 1_800_000_000n;
const base = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const arbitrum = arbitrumWithdrawalMessage(ARBITRUM_WITHDRAWAL_LOGS)!;

const client = ({
  logs = BASE_WITHDRAWAL_LOGS,
  status = 'success',
  receiptError
}: { logs?: Log[]; status?: 'success' | 'reverted'; receiptError?: Error } = {}) =>
  ({
    getTransactionReceipt: vi.fn(async () => {
      if (receiptError) throw receiptError;
      return { status, logs, blockNumber: BASE_WITHDRAWAL_TX.blockNumber, transactionIndex: 0 };
    }),
    getBlock: vi.fn(async () => ({ timestamp: BLOCK_SECONDS }))
  }) as unknown as ChainReader;

describe('lookupNativeWithdrawal', () => {
  it('builds the pending OP Stack withdrawal the tracker proves and finalizes, started at its block', async () => {
    const result = await lookupNativeWithdrawal({
      from: 'base',
      txHash: BASE_WITHDRAWAL_TX.hash.toUpperCase().replace('0X', '0x') as Hex,
      account: base.from,
      client: client()
    });
    const startedAt = Number(BLOCK_SECONDS) * 1000;
    expect(result).toEqual({
      status: 'found',
      bridge: {
        id: BASE_WITHDRAWAL_TX.hash,
        account: base.from.toLowerCase(),
        amount: base.amount,
        recipient: base.to.toLowerCase(),
        token: 'USDS',
        from: 'base',
        to: 'ethereum',
        status: 'pending',
        routeKind: 'native',
        requiresClaim: true,
        nextAction: 'prove',
        startedAt,
        etaAt: startedAt + 5 * DAY_MINUTES * 60_000,
        txHash: BASE_WITHDRAWAL_TX.hash,
        actions: []
      }
    });
  });

  it('builds the pending Arbitrum withdrawal the tracker executes on the outbox', async () => {
    const result = await lookupNativeWithdrawal({
      from: 'arbitrum',
      txHash: ARBITRUM_WITHDRAWAL_TX.hash,
      account: arbitrum.from,
      client: client({ logs: ARBITRUM_WITHDRAWAL_LOGS })
    });
    expect(result.status === 'found' && result.bridge).toMatchObject({
      account: arbitrum.from.toLowerCase(),
      amount: arbitrum.amount,
      recipient: arbitrum.to.toLowerCase(),
      from: 'arbitrum',
      routeKind: 'native',
      nextAction: 'finalize'
    });
  });

  it("keeps the sender as the account and names the recipient for a third wallet's lookup", async () => {
    const result = await lookupNativeWithdrawal({
      from: 'base',
      txHash: BASE_WITHDRAWAL_TX.hash,
      account: OTHER,
      client: client()
    });
    expect(result.status === 'found' && result.bridge.recipient).toBe(base.to.toLowerCase());
    expect(result.status === 'found' && result.bridge.account).toBe(base.from.toLowerCase());
  });

  it('uses the route the resolver builds for the native withdrawal, with no fallback reason', () => {
    const route = nativeWithdrawalRoute('optimism');
    expect(route).toMatchObject({ kind: 'native', etaMinutes: 7 * DAY_MINUTES, requiresClaim: true });
    expect(route.steps.map(step => `${step.network}:${step.action}`)).toEqual([
      'optimism:approve',
      'optimism:send',
      'ethereum:prove',
      'ethereum:finalize'
    ]);
    expect(route.fallbackReason).toBeUndefined();
  });

  it.each([
    ['another network', 'optimism' as const, BASE_WITHDRAWAL_LOGS],
    ['an OP Stack receipt read as Arbitrum', 'arbitrum' as const, OPTIMISM_WITHDRAWAL_LOGS],
    ['an Arbitrum receipt read as OP Stack', 'base' as const, ARBITRUM_WITHDRAWAL_LOGS],
    ['a CCTP burn', 'base' as const, BASE_BURN_LOGS]
  ])('refuses %s as not a bridge', async (_, from, logs) => {
    const result = await lookupNativeWithdrawal({
      from,
      txHash: BASE_WITHDRAWAL_TX.hash,
      account: base.from,
      client: client({ logs })
    });
    expect(result).toEqual({ status: 'refused', reason: 'not-a-bridge' });
  });

  it('refuses a receipt with two USDS withdrawals as not a bridge', async () => {
    const result = await lookupNativeWithdrawal({
      from: 'base',
      txHash: BASE_WITHDRAWAL_TX.hash,
      account: base.from,
      client: client({ logs: [...BASE_WITHDRAWAL_LOGS, ...BASE_WITHDRAWAL_LOGS] })
    });
    expect(result).toEqual({ status: 'refused', reason: 'not-a-bridge' });
  });

  it('refuses a reverted transaction', async () => {
    const result = await lookupNativeWithdrawal({
      from: 'base',
      txHash: BASE_WITHDRAWAL_TX.hash,
      account: base.from,
      client: client({ status: 'reverted' })
    });
    expect(result).toEqual({ status: 'refused', reason: 'reverted' });
  });

  it('refuses a hash with no receipt on the network', async () => {
    const result = await lookupNativeWithdrawal({
      from: 'base',
      txHash: BASE_WITHDRAWAL_TX.hash,
      account: base.from,
      client: client({ receiptError: new TransactionReceiptNotFoundError({ hash: BASE_WITHDRAWAL_TX.hash }) })
    });
    expect(result).toEqual({ status: 'refused', reason: 'not-found' });
  });

  it('throws network read errors, so the lookup can be retried', async () => {
    await expect(
      lookupNativeWithdrawal({
        from: 'base',
        txHash: BASE_WITHDRAWAL_TX.hash,
        account: base.from,
        client: client({ receiptError: new Error('RPC down') })
      })
    ).rejects.toThrow('RPC down');
  });
});
