// @vitest-environment happy-dom
/**
 * Aggregator wiring tests: every transport is vi.mocked and each test gets a
 * fresh QueryClient, so these verify the hook's row discipline (one failing
 * source never sinks the rest), the disconnected gate, the fetch
 * arguments (mainnet scope, window bounds), and the shared Pendle raw-rows
 * cache key. Per-source MATH is covered by the compute suites — payloads here
 * are minimal, with hand-visible arithmetic in the comments.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  address: undefined as string | undefined,
  fetchUserVaultV2Pnl: vi.fn(),
  fetchVaultV2TransactionsSince: vi.fn(),
  fetchMerklUserRewards: vi.fn(),
  fetchMerklClaims: vi.fn(),
  fetchBaLabsHistoricDailyPrices: vi.fn(),
  fetchPendlePnlTransactionsForUser: vi.fn(),
  fetchPendlePnlGainedPositions: vi.fn(),
  fetchPendleDashboardPositions: vi.fn(),
  fetchVaultsFyiTotalReturns: vi.fn(),
  fetchVaultsFyiPartialReturns: vi.fn()
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: h.address })
}));
vi.mock('../../../hooks/morpho/morphoPnlClient', () => ({
  fetchUserVaultV2Pnl: h.fetchUserVaultV2Pnl,
  fetchVaultV2TransactionsSince: h.fetchVaultV2TransactionsSince
}));
vi.mock('../../../hooks/morpho/merklEarnedClient', () => ({
  fetchMerklUserRewards: h.fetchMerklUserRewards,
  fetchMerklClaims: h.fetchMerklClaims
}));
vi.mock('../../../hooks/prices/baLabsHistoricPrices', () => ({
  fetchBaLabsHistoricDailyPrices: h.fetchBaLabsHistoricDailyPrices
}));
vi.mock('../../../hooks/pendle/pendleApiClient', () => ({
  fetchPendlePnlTransactionsForUser: h.fetchPendlePnlTransactionsForUser,
  fetchPendlePnlGainedPositions: h.fetchPendlePnlGainedPositions,
  fetchPendleDashboardPositions: h.fetchPendleDashboardPositions
}));
vi.mock('../../../hooks/vaults/fyi/vaultsFyiClient', () => ({
  fetchVaultsFyiTotalReturns: h.fetchVaultsFyiTotalReturns,
  fetchVaultsFyiPartialReturns: h.fetchVaultsFyiPartialReturns
}));
vi.mock('../../../hooks/vaults/fyi/constants', () => ({
  SUSDS_VAULT_ID_MAINNET: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
  STUSDS_VAULT_ID_MAINNET: '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9'
}));

import { MORPHO_VAULTS, MorphoTransactionType } from '../../../hooks/morpho/constants';
import type { MorphoUserVaultV2Position, MorphoVaultV2Transaction } from '../../../hooks/morpho/morpho';
import type { MerklClaimRaw, MerklUserRewardRaw } from '../../../hooks/morpho/merklEarnedClient';
import type { PendlePnlTransactionRaw } from '../../../hooks/pendle/pendle';
import { pendlePnlQueryKey } from '../../../hooks/pendle/usePendleAllPnlTransactions';
import { useWalletEarnings } from './useWalletEarnings';

const USER = '0x1111111111111111111111111111111111111111';
const FLAGSHIP = '0xE15fcC81118895b67b6647BBd393182dF44E11E0';
// One earnings source per supported vault (config order), Flagship included.
const MORPHO_VAULT_ADDRESSES = MORPHO_VAULTS.map(v => v.vaultAddress[1]);
const MORPHO_VAULT_IDS = MORPHO_VAULT_ADDRESSES.map(a => `morpho-vault-${a.toLowerCase()}`);
const MORPHO_FLAGSHIP_ID = `morpho-vault-${FLAGSHIP.toLowerCase()}`;
const SOURCE_COUNT = MORPHO_VAULT_IDS.length + 4; // + merkl, pendle, savings, stusds
const PENDLE_MARKET = '0x9c560ebaf78e596cbcc27411d633a74d628dd7dc';
const USDS_TOKEN = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

// External anchor: 2026-08-01T00:00:00Z (verified in the APP-450 spike).
const AUG_1 = 1785542400;
const DAY = 86400;
const SEP_1 = AUG_1 + 31 * DAY; // August has 31 days
const NOW_MS = (AUG_1 + 18 * DAY + 12 * 3600) * 1000; // 2026-08-19T12:00:00Z

// --- Morpho: total = pnl 20 USDS / $20; monthly = 150 − 100 − 40 = 10 USDS ---
const morphoPositions: MorphoUserVaultV2Position[] = [
  {
    vault: { address: FLAGSHIP, asset: { symbol: 'USDS', decimals: 6 } },
    assets: 150_000_000,
    assetsUsd: 150,
    pnl: 20_000_000,
    pnlUsd: 20,
    roe: 0.1,
    history: { assets: [{ x: AUG_1, y: 100_000_000 }] }
  }
];
const morphoTransactions: MorphoVaultV2Transaction[] = [
  {
    vault: { address: FLAGSHIP, asset: { symbol: 'USDS', decimals: 6 } },
    type: MorphoTransactionType.Deposit,
    timestamp: AUG_1 + 5 * DAY,
    txHash: '0xdep',
    data: { assets: '40000000' }
  }
];

// --- Merkl: earned 5, claimed 2 @ $0.5 on Aug 10 + unclaimed 3 @ $1 = $4 ---
const merklRewards: MerklUserRewardRaw[] = [
  {
    root: '0xroot',
    recipient: USER,
    amount: '5000000',
    claimed: '2000000',
    pending: '0',
    token: { address: USDS_TOKEN, chainId: 1, symbol: 'USDS', decimals: 6, price: 1 },
    breakdowns: [
      { reason: `ERC20_${FLAGSHIP}`, amount: '5000000', claimed: '2000000', pending: '0', campaignId: '0xc' }
    ]
  }
];
const merklClaims: MerklClaimRaw[] = [
  {
    id: 'c1',
    chainId: 1,
    timestamp: AUG_1 + 9 * DAY, // 2026-08-10
    token: USDS_TOKEN,
    reason: `ERC20_${FLAGSHIP}`,
    amount: '2000000'
  }
];
const merklPrices = new Map([['2026-08-10', 0.5]]);

// --- Pendle: MTM = 120 − 100 + 50 = 70; monthly = Σ profit = 7 -----------------
const pendleRawRows = [
  {
    market: PENDLE_MARKET,
    chainId: 1,
    timestamp: '2026-08-10T00:00:00.000Z',
    action: 'redeemMarketRewards',
    txHash: '0xrew',
    profit: { usd: 7 }
  }
] as unknown as PendlePnlTransactionRaw[];
const pendleGained = [
  { market: PENDLE_MARKET, chainId: 1, pnl: { netGain: { usd: 50 }, totalSpent: { usd: 100 } } }
];
const pendleDashboard = [
  {
    chainId: 1,
    openPositions: [
      {
        marketId: `1-${PENDLE_MARKET}`,
        pt: { valuation: 120, balance: '0' },
        yt: { valuation: 0, balance: '0' },
        lp: { valuation: 0, balance: '0' }
      }
    ],
    closedPositions: []
  }
];

// --- Savings: total 46.4 sUSDS @ $1; monthly 5 ---------------------------------
const savingsAsset = {
  address: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
  assetCaip: 'eip155:1/erc20:0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
  name: 'Savings USDS',
  symbol: 'sUSDS',
  decimals: 6,
  assetPriceInUsd: '1',
  assetGroup: 'USD'
};
const savingsTotal = { ...savingsAsset, returnsNative: '46400000' };
const savingsPartial = {
  ...savingsAsset,
  returnsNative: '5000000',
  fromTimestamp: AUG_1,
  toTimestamp: AUG_1 + 18 * DAY
};

// --- stUSDS: total 30 @ $1; monthly -2 (cut() can make earned negative) ---
const STUSDS_VAULT_ID = '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9';
const stusdsAsset = { ...savingsAsset, name: 'Staked USDS', symbol: 'USDS' };
const stusdsTotal = { ...stusdsAsset, returnsNative: '30000000' };
const stusdsPartial = {
  ...stusdsAsset,
  returnsNative: '-2000000',
  fromTimestamp: AUG_1,
  toTimestamp: AUG_1 + 18 * DAY
};

const FLAGSHIP_ROW_ID = `vault-morpho-${FLAGSHIP.toLowerCase()}`;

function renderEarnings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => useWalletEarnings(), { wrapper }) };
}

const protocolById = (result: ReturnType<typeof useWalletEarnings>, id: string) =>
  result.protocols.find(p => p.id === id)!;

describe('useWalletEarnings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW_MS);
    h.address = USER;
    h.fetchUserVaultV2Pnl.mockResolvedValue(morphoPositions);
    h.fetchVaultV2TransactionsSince.mockResolvedValue(morphoTransactions);
    h.fetchMerklUserRewards.mockResolvedValue(merklRewards);
    h.fetchMerklClaims.mockResolvedValue(merklClaims);
    h.fetchBaLabsHistoricDailyPrices.mockResolvedValue(merklPrices);
    h.fetchPendlePnlTransactionsForUser.mockResolvedValue(pendleRawRows);
    h.fetchPendlePnlGainedPositions.mockResolvedValue(pendleGained);
    h.fetchPendleDashboardPositions.mockResolvedValue(pendleDashboard);
    // The savings and stUSDS sources share the transport fns — route by vaultId.
    h.fetchVaultsFyiTotalReturns.mockImplementation(async ({ vaultId }: { vaultId: string }) =>
      vaultId === STUSDS_VAULT_ID ? stusdsTotal : savingsTotal
    );
    h.fetchVaultsFyiPartialReturns.mockImplementation(async ({ vaultId }: { vaultId: string }) =>
      vaultId === STUSDS_VAULT_ID ? stusdsPartial : savingsPartial
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reports every source as the disconnected gap without fetching when no wallet is connected', () => {
    h.address = undefined;
    const { result } = renderEarnings();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.protocols).toHaveLength(SOURCE_COUNT);
    for (const protocol of result.current.protocols) {
      expect(protocol.totalEarned).toEqual({ status: 'notAvailable', reason: 'disconnected' });
      expect(protocol.earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'disconnected' });
      expect(protocol.isLoading).toBe(false);
    }
    expect(result.current.combined.missingFromTotal).toHaveLength(SOURCE_COUNT);
    expect(result.current.combined.missingFromMonth).toHaveLength(SOURCE_COUNT);

    expect(h.fetchUserVaultV2Pnl).not.toHaveBeenCalled();
    expect(h.fetchMerklUserRewards).not.toHaveBeenCalled();
    expect(h.fetchPendlePnlTransactionsForUser).not.toHaveBeenCalled();
    expect(h.fetchVaultsFyiTotalReturns).not.toHaveBeenCalled();
  });

  it('aggregates all five sources with the month window and mainnet-scoped fetch args', async () => {
    const { result, queryClient } = renderEarnings();

    // Loading state first: figures are the transient 'loading' gap, never $0.
    expect(result.current.isLoading).toBe(true);
    expect(protocolById(result.current, MORPHO_FLAGSHIP_ID).totalEarned).toEqual({
      status: 'notAvailable',
      reason: 'loading'
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.window).toEqual({ startSec: AUG_1, endSec: SEP_1 - 1 });

    const morpho = protocolById(result.current, MORPHO_FLAGSHIP_ID);
    expect(morpho.rowIds).toEqual([FLAGSHIP_ROW_ID]);
    expect(morpho.label).toBe('USDS Flagship');
    expect(morpho.totalEarned).toEqual({
      status: 'ok',
      value: { usd: 20, native: { amount: 20, symbol: 'USDS' } }
    });
    expect(morpho.earnedThisMonth).toEqual({
      status: 'ok',
      value: { usd: 10, native: { amount: 10, symbol: 'USDS' } }
    });
    // The Flagship row also carries Merkl rewards, so no coverage caveat.
    expect(morpho.coverage).toBeUndefined();

    // Non-Flagship vaults: own source per vault, untouched → genuinely $0,
    // and the announced note that Merkl rewards aren't attributed to them yet.
    for (const id of MORPHO_VAULT_IDS.filter(v => v !== MORPHO_FLAGSHIP_ID)) {
      const vault = protocolById(result.current, id);
      expect(vault.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
      expect(vault.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 0 } });
      expect(vault.coverage).toBe('rewards-not-included');
      expect(vault.label).toBeTruthy();
    }

    const merkl = protocolById(result.current, 'merkl');
    expect(merkl.rowIds).toEqual([FLAGSHIP_ROW_ID]);
    // 2 claimed × $0.5 (price on the Aug 10 claim day) + 3 unclaimed × $1 = $4
    expect(merkl.totalEarned).toEqual({
      status: 'ok',
      value: { usd: 4, native: { amount: 5, symbol: 'USDS' } }
    });
    expect(merkl.earnedThisMonth).toEqual({
      status: 'notAvailable',
      reason: 'merkl-monthly-unsupported'
    });

    const pendle = protocolById(result.current, 'pendle');
    expect(pendle.rowIds).toEqual([`fixed-${PENDLE_MARKET}`]);
    expect(pendle.totalEarned).toEqual({ status: 'ok', value: { usd: 70 } });
    expect(pendle.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 7 } });
    expect(pendle.pendleSplit).toEqual({ realizedUsd: 50, markToMarketUsd: 70 });

    const savings = protocolById(result.current, 'savings');
    expect(savings.rowIds).toEqual(['savings']);
    expect(savings.totalEarned).toEqual({
      status: 'ok',
      value: { usd: 46.4, native: { amount: 46.4, symbol: 'sUSDS' } }
    });
    expect(savings.earnedThisMonth).toEqual({
      status: 'ok',
      value: { usd: 5, native: { amount: 5, symbol: 'sUSDS' } }
    });
    // Review finding #3: the savings row balance spans chains but vaults.fyi
    // only indexes mainnet sUSDS — the figure must announce its coverage.
    expect(savings.coverage).toBe('mainnet-only');

    const stusds = protocolById(result.current, 'stusds');
    expect(stusds.rowIds).toEqual(['stusds']);
    expect(stusds.totalEarned).toEqual({
      status: 'ok',
      value: { usd: 30, native: { amount: 30, symbol: 'USDS' } }
    });
    expect(stusds.earnedThisMonth).toEqual({
      status: 'ok',
      value: { usd: -2, native: { amount: -2, symbol: 'USDS' } }
    });

    // Combined: 20 + 4 + 70 + 46.4 + 30 = 170.4 total; 10 + 7 + 5 − 2 = 20 monthly.
    expect(result.current.combined.totalEarnedUsd).toBeCloseTo(170.4, 10);
    expect(result.current.combined.earnedThisMonthUsd).toBeCloseTo(20, 10);
    expect(result.current.combined.missingFromTotal).toEqual([]);
    expect(result.current.combined.missingFromMonth).toEqual(['merkl']);

    // Fetch args: mainnet scope everywhere, window bounds where relevant.
    expect(h.fetchUserVaultV2Pnl).toHaveBeenCalledWith({
      userAddress: USER,
      chainId: 1,
      // One DAY bucket of headroom so a pre-existing position always has a
      // baseline sample at or before the month start.
      startTimestamp: AUG_1 - DAY,
      // Clamped to "now" at fetch time — the verified call shape ends at the clock.
      endTimestamp: NOW_MS / 1000
    });
    expect(h.fetchVaultV2TransactionsSince).toHaveBeenCalledWith({
      userAddress: USER,
      chainId: 1,
      vaultAddresses: MORPHO_VAULT_ADDRESSES,
      sinceTimestamp: AUG_1
    });
    expect(h.fetchMerklUserRewards).toHaveBeenCalledWith({ userAddress: USER, chainId: 1 });
    expect(h.fetchMerklClaims).toHaveBeenCalledWith({ userAddress: USER, chainId: 1 });
    expect(h.fetchBaLabsHistoricDailyPrices).toHaveBeenCalledWith({
      tokenAddress: USDS_TOKEN.toLowerCase()
    });
    expect(h.fetchPendlePnlTransactionsForUser).toHaveBeenCalledWith(USER, { chainId: 1 });
    expect(h.fetchPendlePnlGainedPositions).toHaveBeenCalledWith(USER);
    expect(h.fetchPendleDashboardPositions).toHaveBeenCalledWith(USER);
    expect(h.fetchVaultsFyiTotalReturns).toHaveBeenCalledWith({
      userAddress: USER,
      vaultId: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD'
    });
    expect(h.fetchVaultsFyiPartialReturns).toHaveBeenCalledWith({
      userAddress: USER,
      vaultId: '0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD',
      fromTimestamp: AUG_1
    });

    // The raw Pendle rows land under the SHARED history-hook cache key, so the
    // single /v1/pnl/transactions call serves both this hook and the history UI.
    expect(queryClient.getQueryData(pendlePnlQueryKey(USER as `0x${string}`))).toBe(pendleRawRows);
  });

  it('degrades only the failing source to source-error, keeping the others intact', async () => {
    h.fetchUserVaultV2Pnl.mockRejectedValue(new Error('morpho down'));
    const { result } = renderEarnings();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const morpho = protocolById(result.current, MORPHO_FLAGSHIP_ID);
    expect(morpho.totalEarned).toEqual({ status: 'notAvailable', reason: 'source-error' });
    expect(morpho.earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'source-error' });
    expect(morpho.error).toBeInstanceOf(Error);

    expect(protocolById(result.current, 'merkl').totalEarned.status).toBe('ok');
    expect(protocolById(result.current, 'pendle').totalEarned.status).toBe('ok');
    expect(protocolById(result.current, 'savings').totalEarned.status).toBe('ok');

    // Combined still sums the healthy sources and names what is missing —
    // the single Morpho query feeds every vault source, so all degrade.
    expect(result.current.combined.totalEarnedUsd).toBeCloseTo(4 + 70 + 46.4 + 30, 10);
    expect(result.current.combined.missingFromTotal).toEqual([...MORPHO_VAULT_IDS]);
  });

  it('keeps the savings figures independent: a failing partial-returns call never sinks the total', async () => {
    h.fetchVaultsFyiPartialReturns.mockRejectedValue(new Error('beta 500'));
    const { result } = renderEarnings();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const savings = protocolById(result.current, 'savings');
    expect(savings.totalEarned).toEqual({
      status: 'ok',
      value: { usd: 46.4, native: { amount: 46.4, symbol: 'sUSDS' } }
    });
    expect(savings.earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'source-error' });
    expect(savings.error).toBeInstanceOf(Error);
  });

  it('fetches stUSDS with its own vaultId and passes the negative month through signed', async () => {
    const { result } = renderEarnings();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const stusds = protocolById(result.current, 'stusds');
    expect(stusds.totalEarned).toEqual({
      status: 'ok',
      value: { usd: 30, native: { amount: 30, symbol: 'USDS' } }
    });
    expect(stusds.earnedThisMonth).toEqual({
      status: 'ok',
      value: { usd: -2, native: { amount: -2, symbol: 'USDS' } }
    });

    expect(h.fetchVaultsFyiTotalReturns).toHaveBeenCalledWith(
      expect.objectContaining({ vaultId: STUSDS_VAULT_ID })
    );
    expect(h.fetchVaultsFyiPartialReturns).toHaveBeenCalledWith(
      expect.objectContaining({ vaultId: STUSDS_VAULT_ID, fromTimestamp: AUG_1 })
    );

    // Savings is untouched by the second consumer of the shared transports.
    expect(protocolById(result.current, 'savings').totalEarned).toEqual({
      status: 'ok',
      value: { usd: 46.4, native: { amount: 46.4, symbol: 'sUSDS' } }
    });
    expect(result.current.combined.totalEarnedUsd).toBeCloseTo(20 + 4 + 70 + 46.4 + 30, 10);
    expect(result.current.combined.missingFromTotal).toEqual([]);
  });

  it('degrades a failing stUSDS fetch to source-error without sinking the other sources', async () => {
    h.fetchVaultsFyiTotalReturns.mockImplementation(async ({ vaultId }: { vaultId: string }) => {
      if (vaultId === STUSDS_VAULT_ID) throw new Error('vaults.fyi /total-returns 404');
      return savingsTotal;
    });
    h.fetchVaultsFyiPartialReturns.mockImplementation(async ({ vaultId }: { vaultId: string }) => {
      if (vaultId === STUSDS_VAULT_ID) throw new Error('vaults.fyi /partial-returns 404');
      return savingsPartial;
    });
    const { result } = renderEarnings();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const stusds = protocolById(result.current, 'stusds');
    expect(stusds.totalEarned).toEqual({ status: 'notAvailable', reason: 'source-error' });
    expect(stusds.earnedThisMonth).toEqual({ status: 'notAvailable', reason: 'source-error' });
    expect(stusds.error).toBeInstanceOf(Error);
    expect(protocolById(result.current, 'savings').totalEarned.status).toBe('ok');
    expect(result.current.combined.missingFromTotal).toEqual(['stusds']);
  });

  it('skips the historic-price fetch entirely for a wallet with no attributed Merkl rewards', async () => {
    h.fetchMerklUserRewards.mockResolvedValue([]);
    h.fetchMerklClaims.mockResolvedValue([]);
    const { result } = renderEarnings();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const merkl = protocolById(result.current, 'merkl');
    expect(merkl.totalEarned).toEqual({ status: 'ok', value: { usd: 0 } });
    expect(merkl.earnedThisMonth).toEqual({ status: 'ok', value: { usd: 0 } });
    expect(h.fetchBaLabsHistoricDailyPrices).not.toHaveBeenCalled();
  });
});
