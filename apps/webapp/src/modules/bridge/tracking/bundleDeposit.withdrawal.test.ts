import { describe, expect, it } from 'vitest';
import type { Address, Hex, Log } from 'viem';
import { arbitrumWithdrawalMessage } from '../adapters/nativeWithdrawal/arbitrum';
import { opStackWithdrawalMessage } from '../adapters/nativeWithdrawal/opStack';
import {
  ARBITRUM_WITHDRAWAL_LOGS,
  BASE_WITHDRAWAL_LOGS,
  OPTIMISM_WITHDRAWAL_LOGS
} from '../adapters/nativeWithdrawal/withdrawalFixtures';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeWithdrawalRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { bundleDepositIn, type BundleReceipt } from './bundleDeposit';

const BUNDLE_TX = `0x${'b'.repeat(64)}` as Hex;
const OTHER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const base = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const arbitrum = arbitrumWithdrawalMessage(ARBITRUM_WITHDRAWAL_LOGS)!;

const card = (
  from: 'base' | 'arbitrum',
  message: { from: Address; to: Address; amount: bigint },
  overrides: Partial<PendingBridge> = {}
): PendingBridge => ({
  ...createPendingBridge({
    account: message.from.toLowerCase(),
    amount: message.amount,
    from,
    to: 'ethereum',
    recipient: message.to.toLowerCase(),
    route: nativeWithdrawalRoute(from),
    bundleId: 'bundle-1',
    now: 0
  }),
  ...overrides
});

const receipt = (logs: Log[], overrides: Partial<BundleReceipt> = {}): BundleReceipt => ({
  status: 'success',
  transactionHash: BUNDLE_TX,
  blockNumber: 42n,
  logs: logs.map(({ address, data, topics }) => ({ address, data, topics: topics as Hex[] })),
  ...overrides
});

describe('bundleDepositIn, a native withdrawal (golden: real Base, OP Mainnet and Arbitrum withdrawals)', () => {
  it("finds the card's OP Stack withdrawal in the bundle's receipt", () => {
    expect(bundleDepositIn(card('base', base), [receipt(BASE_WITHDRAWAL_LOGS)])).toEqual({
      txHash: BUNDLE_TX,
      blockNumber: 42n
    });
  });

  it("finds the card's Arbitrum withdrawal in the bundle's receipt", () => {
    expect(bundleDepositIn(card('arbitrum', arbitrum), [receipt(ARBITRUM_WITHDRAWAL_LOGS)])).toEqual({
      txHash: BUNDLE_TX,
      blockNumber: 42n
    });
  });

  it('picks the receipt with the withdrawal among the bundle’s others', () => {
    const approve = receipt([], { transactionHash: `0x${'a'.repeat(64)}` as Hex, blockNumber: 41n });
    expect(bundleDepositIn(card('base', base), [approve, receipt(BASE_WITHDRAWAL_LOGS)])).toEqual({
      txHash: BUNDLE_TX,
      blockNumber: 42n
    });
  });

  it.each([
    ['another amount', { amount: base.amount + 1n }],
    ['another recipient', { recipient: OTHER }],
    ['another sender', { account: OTHER }]
  ])("finds nothing for a withdrawal with %s than the card's", (_, overrides) => {
    expect(bundleDepositIn(card('base', base, overrides), [receipt(BASE_WITHDRAWAL_LOGS)])).toBeUndefined();
  });

  it("finds nothing in another network's receipt, or a reverted one", () => {
    expect(bundleDepositIn(card('base', base), [receipt(OPTIMISM_WITHDRAWAL_LOGS)])).toBeUndefined();
    expect(
      bundleDepositIn(card('base', base), [receipt(BASE_WITHDRAWAL_LOGS, { status: 'reverted' })])
    ).toBeUndefined();
  });

  it('finds nothing when two receipts carry a matching withdrawal', () => {
    const second = receipt(BASE_WITHDRAWAL_LOGS, { transactionHash: `0x${'c'.repeat(64)}` as Hex });
    expect(bundleDepositIn(card('base', base), [receipt(BASE_WITHDRAWAL_LOGS), second])).toBeUndefined();
  });
});
