import { describe, expect, it } from 'vitest';
import type { Address, Hex } from 'viem';
import {
  BASE_BURN_AMOUNT,
  BASE_BURN_LOGS,
  BASE_BURN_MINT_RECIPIENT,
  BASE_BURN_TX
} from '../adapters/cctp/cctpFixtures';
import { createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { bundleDepositIn, type BundleReceipt } from './bundleDeposit';

const BUNDLE_TX = `0x${'b'.repeat(64)}` as Hex;

const card = (overrides: Partial<PendingBridge> = {}): PendingBridge => {
  const result = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  return {
    ...createPendingBridge({
      account: BASE_BURN_TX.from.toLowerCase(),
      // Dust below one USDC unit stays in the wallet: the card keeps the amount entered.
      amount: BASE_BURN_AMOUNT * 10n ** 12n + 5n,
      from: 'base',
      to: 'ethereum',
      route: result.route,
      bundleId: 'bundle-1',
      now: 0
    }),
    ...overrides
  };
};

const receipt = (overrides: Partial<BundleReceipt> = {}): BundleReceipt => ({
  status: 'success',
  transactionHash: BUNDLE_TX,
  blockNumber: 42n,
  logs: BASE_BURN_LOGS.map(({ address, data, topics }) => ({
    address: address as Address,
    data,
    topics: topics as Hex[]
  })),
  ...overrides
});

describe('bundleDepositIn, a CCTP burn (golden: Base burn 0x5bb3d46a…6b6a)', () => {
  it("finds the card's burn in the bundle's receipt", () => {
    expect(bundleDepositIn(card(), [receipt()])).toEqual({ txHash: BUNDLE_TX, blockNumber: 42n });
    expect(bundleDepositIn(card({ recipient: BASE_BURN_MINT_RECIPIENT }), [receipt()])).toBeDefined();
  });

  it.each([
    ['another amount', { amount: (BASE_BURN_AMOUNT + 1n) * 10n ** 12n }],
    ['another recipient', { recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F' }],
    ['another sender', { account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' }],
    ['another source chain', { from: 'optimism' as const }]
  ])('finds nothing for a card with %s', (_, change) => {
    expect(bundleDepositIn(card(change), [receipt()])).toBeUndefined();
  });

  it('finds nothing in a reverted receipt, or when two burns match', () => {
    expect(bundleDepositIn(card(), [receipt({ status: 'reverted' })])).toBeUndefined();
    expect(bundleDepositIn(card(), [receipt(), receipt()])).toBeUndefined();
  });
});
