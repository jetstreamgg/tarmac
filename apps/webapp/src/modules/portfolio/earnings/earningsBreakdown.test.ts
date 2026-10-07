import { describe, expect, it } from 'vitest';
import { buildEarningsBreakdown, type BreakdownProduct } from './earningsBreakdown';
import { combineWalletEarnings } from './combineWalletEarnings';
import { notAvailable, ok, type ProtocolEarnings, type WalletEarnings } from './types';

const proto = (
  id: ProtocolEarnings['id'],
  rowIds: string[],
  totalEarned: ProtocolEarnings['totalEarned'],
  earnedThisMonth: ProtocolEarnings['earnedThisMonth'] = totalEarned,
  extra: Partial<ProtocolEarnings> = {}
): ProtocolEarnings => ({
  id,
  rowIds,
  totalEarned,
  earnedThisMonth,
  isLoading: false,
  error: null,
  ...extra
});

const earningsOf = (protocols: ProtocolEarnings[]): WalletEarnings => ({
  protocols,
  combined: combineWalletEarnings(protocols),
  isLoading: false,
  window: { startSec: 0, endSec: 0 }
});

const product = (id: string, kind: BreakdownProduct['kind'] = 'vault'): BreakdownProduct => ({
  id,
  name: id,
  tokenSymbol: 'USDS',
  kind
});

const PRODUCTS = [
  product('savings', 'savings'),
  product('vault-morpho-0xflagship'),
  product('vault-morpho-0xother'),
  product('rewards-spk', 'rewards'),
  product('rewards-cle', 'rewards'),
  product('stusds', 'stusds')
];

const summary = (rows: ReturnType<typeof buildEarningsBreakdown>) =>
  rows.map(r => [r.product.id, r.usd, r.untracked ?? false, r.isLoading]);

describe('buildEarningsBreakdown', () => {
  it('lists held products and exited ones that earned, largest first, untracked last at $0', () => {
    const earnings = earningsOf([
      proto('savings', ['savings'], ok({ usd: 5 }), ok({ usd: 1 }), { coverage: 'mainnet-only' }),
      proto('morpho-vault-0xflagship', ['vault-morpho-0xflagship'], ok({ usd: 20 })),
      proto('merkl', ['vault-morpho-0xflagship'], ok({ usd: 4 }), notAvailable('merkl-monthly-unsupported')),
      // Exited, still earned → listed; exited with nothing → dropped.
      proto('reward-farm-0xspk', ['rewards-spk'], ok({ usd: 7 })),
      proto('stusds', ['stusds'], ok({ usd: 0 }))
    ]);
    const held = new Set(['savings', 'vault-morpho-0xflagship', 'rewards-cle']);

    expect(
      summary(buildEarningsBreakdown({ earnings, field: 'total', products: PRODUCTS, heldRowIds: held }))
    ).toEqual([
      ['vault-morpho-0xflagship', 24, false, false],
      ['rewards-spk', 7, false, false],
      ['savings', 5, false, false],
      ['rewards-cle', 0, true, false]
    ]);

    // Month: Merkl has no monthly figure, so the Flagship row is the vault alone.
    expect(
      summary(buildEarningsBreakdown({ earnings, field: 'month', products: PRODUCTS, heldRowIds: held }))
    ).toEqual([
      ['vault-morpho-0xflagship', 20, false, false],
      ['rewards-spk', 7, false, false],
      ['savings', 1, false, false],
      ['rewards-cle', 0, true, false]
    ]);
  });

  it('lists a failed source without a figure, even when exited', () => {
    const earnings = earningsOf([
      proto('morpho-vault-0xflagship', ['vault-morpho-0xflagship'], ok({ usd: 20 })),
      proto('merkl', ['vault-morpho-0xflagship'], notAvailable('source-error')),
      proto('stusds', ['stusds'], notAvailable('reconciliation-failed'))
    ]);
    const rows = buildEarningsBreakdown({
      earnings,
      field: 'total',
      products: PRODUCTS,
      heldRowIds: new Set(['vault-morpho-0xflagship'])
    });
    expect(summary(rows)).toEqual([
      ['vault-morpho-0xflagship', 20, false, false],
      ['stusds', undefined, false, false]
    ]);
  });

  it('keeps loading held rows as skeleton rows and skips loading exited ones', () => {
    const earnings = earningsOf([
      proto('savings', ['savings'], notAvailable('loading')),
      proto('stusds', ['stusds'], notAvailable('loading'))
    ]);
    const rows = buildEarningsBreakdown({
      earnings,
      field: 'total',
      products: PRODUCTS,
      heldRowIds: new Set(['savings'])
    });
    expect(summary(rows)).toEqual([['savings', undefined, false, true]]);
  });
});
