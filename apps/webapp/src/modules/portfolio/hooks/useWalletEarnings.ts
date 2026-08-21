import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { usdsFlagshipVaultAddress } from '../../../hooks/generated';
import { fetchMerklClaims, fetchMerklUserRewards } from '../../../hooks/morpho/merklEarnedClient';
import { fetchUserVaultV2Pnl, fetchVaultV2TransactionsSince } from '../../../hooks/morpho/morphoPnlClient';
import { PENDLE_MARKETS } from '../../../hooks/pendle/constants';
import {
  fetchPendleDashboardPositions,
  fetchPendlePnlGainedPositions,
  fetchPendlePnlTransactionsForUser
} from '../../../hooks/pendle/pendleApiClient';
import { pendlePnlQueryKey } from '../../../hooks/pendle/usePendleAllPnlTransactions';
import { fetchBaLabsHistoricDailyPrices } from '../../../hooks/prices/baLabsHistoricPrices';
import {
  EARNINGS_STUSDS_ENABLED,
  STUSDS_VAULT_ID_MAINNET,
  SUSDS_VAULT_ID_MAINNET
} from '../../../hooks/vaults/fyi/constants';
import {
  fetchVaultsFyiPartialReturns,
  fetchVaultsFyiTotalReturns
} from '../../../hooks/vaults/fyi/vaultsFyiClient';
import { combineWalletEarnings } from '../earnings/combineWalletEarnings';
import { attributedRewardTokenAddresses, computeMerklEarnings } from '../earnings/computeMerklEarnings';
import { computeMorphoEarnings } from '../earnings/computeMorphoEarnings';
import { computePendleEarnings } from '../earnings/computePendleEarnings';
import { computeSavingsEarnings, stUsdsPlaceholderEarnings } from '../earnings/computeSavingsEarnings';
import { monthToDateWindow } from '../earnings/monthWindow';
import { notAvailable, type ProtocolEarnings, type WalletEarnings } from '../earnings/types';

const FLAGSHIP = usdsFlagshipVaultAddress[mainnet.id];
const FLAGSHIP_ROW_ID = `vault-morpho-${FLAGSHIP.toLowerCase()}`;
const PENDLE_ROW_IDS = PENDLE_MARKETS.map(m => `fixed-${m.marketAddress.toLowerCase()}`);

const MORPHO_STALE_MS = 10 * 60_000;
const MERKL_REWARDS_STALE_MS = 10 * 60_000;
const MERKL_CLAIMS_STALE_MS = 60 * 60_000;
const BA_PRICES_STALE_MS = 24 * 60 * 60_000;
const PENDLE_STALE_MS = 5 * 60_000;
const VAULTS_FYI_STALE_MS = 45 * 60_000;

/** The transient not-yet-settled gap: 'source-error' once the query failed, 'loading' before. */
const gapFor = (error: unknown) => notAvailable(error ? 'source-error' : 'loading');

const MAX_TIMEOUT_MS = 2 ** 31 - 1; // setTimeout clamps beyond this (~24.8 days)

/**
 * The clock is an external system: expose the month start via
 * useSyncExternalStore with a timer chained to the next month boundary, so a
 * session crossing midnight UTC on the 1st rolls its window (and query keys)
 * over without waiting for an unrelated re-render.
 */
function subscribeToMonthRollover(onStoreChange: () => void): () => void {
  let id: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const nowMs = Date.now();
    const nextBoundaryMs = (monthToDateWindow(nowMs).endSec + 1) * 1000;
    // A month can exceed the setTimeout clamp; an early fire is harmless (the
    // snapshot is unchanged) and the chain re-schedules the remainder.
    id = setTimeout(
      () => {
        onStoreChange();
        schedule();
      },
      Math.min(nextBoundaryMs - nowMs + 1000, MAX_TIMEOUT_MS)
    );
  };
  schedule();
  return () => clearTimeout(id);
}

const monthStartSecSnapshot = (): number => monthToDateWindow(Date.now()).startSec;

/**
 * APP-450 aggregator: per-wallet "Total earned" / "Earned this month" across
 * Morpho Flagship, Merkl rewards, Pendle PT-sUSDS, sUSDS savings and the
 * stUSDS placeholder. Each source runs its own queries with its own
 * isLoading/error (marketplace row discipline) so one failing API never sinks
 * the rest; failures degrade that source to `notAvailable('source-error')`.
 *
 * Scope is MAINNET regardless of the connected network: these products only
 * exist there, and mixing per-chain lookups into a wallet-level figure would
 * make the combined number silently partial (a testnet fork mirrors mainnet
 * state, so the collapse is subsumed by the hardcode — the Pendle history
 * hooks set the precedent). Disconnected wallets get every figure as the
 * announced 'disconnected' gap with all queries disabled — never a false $0.
 */
export function useWalletEarnings(): WalletEarnings {
  const { address } = useConnection();
  const connected = !!address;
  const user = address?.toLowerCase();
  const chainId = mainnet.id;

  // startSec only changes on month rollover, so the window object (and every
  // query key it feeds) stays referentially stable within the month.
  const startSec = useSyncExternalStore(subscribeToMonthRollover, monthStartSecSnapshot);
  const window = useMemo(() => monthToDateWindow(startSec * 1000), [startSec]);

  const morphoQuery = useQuery({
    queryKey: ['wallet-earnings', 'morpho', user, startSec],
    queryFn: async () => {
      // Clamped to the clock at fetch time: the window's endSec is the future
      // month end, while the spike verified the Morpho call with end ≈ now.
      const endTimestamp = Math.min(window.endSec, Math.floor(Date.now() / 1000));
      const [positions, transactions] = await Promise.all([
        fetchUserVaultV2Pnl({
          userAddress: address!,
          chainId,
          startTimestamp: window.startSec,
          endTimestamp
        }),
        fetchVaultV2TransactionsSince({
          userAddress: address!,
          chainId,
          vaultAddresses: [FLAGSHIP],
          sinceTimestamp: window.startSec
        })
      ]);
      return { positions, transactions };
    },
    enabled: connected,
    staleTime: MORPHO_STALE_MS
  });

  const merklRewardsQuery = useQuery({
    queryKey: ['wallet-earnings', 'merkl-rewards', user],
    queryFn: () => fetchMerklUserRewards({ userAddress: address!, chainId }),
    enabled: connected,
    staleTime: MERKL_REWARDS_STALE_MS
  });

  const merklClaimsQuery = useQuery({
    queryKey: ['wallet-earnings', 'merkl-claims', user],
    queryFn: () => fetchMerklClaims({ userAddress: address!, chainId }),
    enabled: connected,
    staleTime: MERKL_CLAIMS_STALE_MS
  });

  const attributedTokens = useMemo(
    () => (merklRewardsQuery.data ? attributedRewardTokenAddresses(merklRewardsQuery.data, FLAGSHIP) : []),
    [merklRewardsQuery.data]
  );

  // Dependent stage: only the attributed reward tokens need a price history.
  // Not user-scoped — a token's daily series is global and cache-shareable.
  const pricesQuery = useQuery({
    queryKey: ['wallet-earnings', 'ba-historic-prices', attributedTokens.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        attributedTokens.map(
          async token => [token, await fetchBaLabsHistoricDailyPrices({ tokenAddress: token })] as const
        )
      );
      return new Map(entries);
    },
    enabled: attributedTokens.length > 0,
    staleTime: BA_PRICES_STALE_MS
  });

  // Shared key with the Pendle history hooks: one /v1/pnl/transactions call
  // serves both; this consumer reads the RAW rows (no select) because the
  // monthly profit lives on LP/reward actions the history normalizer drops.
  const pendleRowsQuery = useQuery({
    queryKey: pendlePnlQueryKey(address as `0x${string}` | undefined),
    queryFn: () => fetchPendlePnlTransactionsForUser(address as `0x${string}`, { chainId: mainnet.id }),
    enabled: connected,
    staleTime: PENDLE_STALE_MS
  });

  const pendleGainedQuery = useQuery({
    queryKey: ['wallet-earnings', 'pendle-gained', user],
    queryFn: () => fetchPendlePnlGainedPositions(address as `0x${string}`),
    enabled: connected,
    staleTime: PENDLE_STALE_MS
  });

  const pendleDashboardQuery = useQuery({
    queryKey: ['wallet-earnings', 'pendle-dashboard', user],
    queryFn: () => fetchPendleDashboardPositions(address as `0x${string}`),
    enabled: connected,
    staleTime: PENDLE_STALE_MS
  });

  // vaults.fyi is per-request billed: long staleTime, no focus refetch.
  const savingsTotalQuery = useQuery({
    queryKey: ['wallet-earnings', 'savings-total', user],
    queryFn: () => fetchVaultsFyiTotalReturns({ userAddress: address!, vaultId: SUSDS_VAULT_ID_MAINNET }),
    enabled: connected,
    staleTime: VAULTS_FYI_STALE_MS,
    refetchOnWindowFocus: false
  });

  const savingsPartialQuery = useQuery({
    queryKey: ['wallet-earnings', 'savings-partial', user, startSec],
    queryFn: () =>
      fetchVaultsFyiPartialReturns({
        userAddress: address!,
        vaultId: SUSDS_VAULT_ID_MAINNET,
        fromTimestamp: window.startSec
      }),
    enabled: connected,
    staleTime: VAULTS_FYI_STALE_MS,
    refetchOnWindowFocus: false
  });

  // stUSDS rides the same vaults.fyi returns endpoints as savings, just with
  // its own vaultId. Off until their holder indexing catches up with the
  // 2026-08-20 listing (see EARNINGS_STUSDS_ENABLED).
  const stusdsEnabled = EARNINGS_STUSDS_ENABLED;
  const stusdsTotalQuery = useQuery({
    queryKey: ['wallet-earnings', 'stusds-total', user],
    queryFn: () => fetchVaultsFyiTotalReturns({ userAddress: address!, vaultId: STUSDS_VAULT_ID_MAINNET }),
    enabled: connected && stusdsEnabled,
    staleTime: VAULTS_FYI_STALE_MS,
    refetchOnWindowFocus: false
  });

  const stusdsPartialQuery = useQuery({
    queryKey: ['wallet-earnings', 'stusds-partial', user, startSec],
    queryFn: () =>
      fetchVaultsFyiPartialReturns({
        userAddress: address!,
        vaultId: STUSDS_VAULT_ID_MAINNET,
        fromTimestamp: window.startSec
      }),
    enabled: connected && stusdsEnabled,
    staleTime: VAULTS_FYI_STALE_MS,
    refetchOnWindowFocus: false
  });

  const protocols = useMemo<ProtocolEarnings[]>(() => {
    if (!connected) {
      const gone = notAvailable('disconnected');
      const entry = (id: ProtocolEarnings['id'], rowIds: string[]): ProtocolEarnings => ({
        id,
        rowIds,
        totalEarned: gone,
        earnedThisMonth: gone,
        isLoading: false,
        error: null
      });
      return [
        entry('morpho-flagship', [FLAGSHIP_ROW_ID]),
        entry('merkl', [FLAGSHIP_ROW_ID]),
        entry('pendle', PENDLE_ROW_IDS),
        entry('savings', ['savings']),
        entry('stusds', ['stusds'])
      ];
    }

    const morpho: ProtocolEarnings = {
      id: 'morpho-flagship',
      rowIds: [FLAGSHIP_ROW_ID],
      ...(morphoQuery.data
        ? computeMorphoEarnings({ ...morphoQuery.data, flagshipVaultAddress: FLAGSHIP, window })
        : { totalEarned: gapFor(morphoQuery.error), earnedThisMonth: gapFor(morphoQuery.error) }),
      isLoading: morphoQuery.isLoading,
      error: morphoQuery.error ?? null
    };

    const merkl: ProtocolEarnings = (() => {
      const pricesNeeded = attributedTokens.length > 0;
      const error = merklRewardsQuery.error ?? merklClaimsQuery.error ?? pricesQuery.error ?? null;
      const ready =
        !!merklRewardsQuery.data && !!merklClaimsQuery.data && (!pricesNeeded || !!pricesQuery.data);
      return {
        id: 'merkl',
        rowIds: [FLAGSHIP_ROW_ID],
        ...(ready
          ? computeMerklEarnings({
              rewards: merklRewardsQuery.data!,
              claims: merklClaimsQuery.data!,
              historicPricesByToken: pricesQuery.data ?? new Map(),
              flagshipVaultAddress: FLAGSHIP
            })
          : { totalEarned: gapFor(error), earnedThisMonth: gapFor(error) }),
        isLoading:
          merklRewardsQuery.isLoading ||
          merklClaimsQuery.isLoading ||
          (pricesNeeded && pricesQuery.isLoading),
        error
      };
    })();

    const pendle: ProtocolEarnings = (() => {
      const error = pendleRowsQuery.error ?? pendleGainedQuery.error ?? pendleDashboardQuery.error ?? null;
      const ready = !!pendleRowsQuery.data && !!pendleGainedQuery.data && !!pendleDashboardQuery.data;
      return {
        id: 'pendle',
        rowIds: PENDLE_ROW_IDS,
        ...(ready
          ? computePendleEarnings({
              gainedPositions: pendleGainedQuery.data!,
              dashboardPositions: pendleDashboardQuery.data!,
              pnlRows: pendleRowsQuery.data!,
              window
            })
          : { totalEarned: gapFor(error), earnedThisMonth: gapFor(error) }),
        isLoading: pendleRowsQuery.isLoading || pendleGainedQuery.isLoading || pendleDashboardQuery.isLoading,
        error
      };
    })();

    const savings: ProtocolEarnings = (() => {
      // The two endpoints map one-to-one onto the two figures, so each
      // degrades on its own — a broken beta call never hides the total.
      const computed = computeSavingsEarnings({
        totalReturns: savingsTotalQuery.data ?? {},
        partialReturns: savingsPartialQuery.data ?? {},
        window
      });
      return {
        id: 'savings' as const,
        rowIds: ['savings'],
        totalEarned: savingsTotalQuery.data ? computed.totalEarned : gapFor(savingsTotalQuery.error),
        earnedThisMonth: savingsPartialQuery.data
          ? computed.earnedThisMonth
          : gapFor(savingsPartialQuery.error),
        // The savings row balance aggregates every supported chain; vaults.fyi
        // only indexes mainnet sUSDS. Announce it, don't silently under-count
        // (review finding #3).
        coverage: 'mainnet-only' as const,
        isLoading: savingsTotalQuery.isLoading || savingsPartialQuery.isLoading,
        error: savingsTotalQuery.error ?? savingsPartialQuery.error ?? null
      };
    })();

    const stusds: ProtocolEarnings = (() => {
      if (!stusdsEnabled) {
        return {
          id: 'stusds' as const,
          rowIds: ['stusds'],
          ...stUsdsPlaceholderEarnings(),
          isLoading: false,
          error: null
        };
      }
      // Same per-figure independence as savings; stUSDS cut() can make earned
      // negative, which computeSavingsEarnings passes through signed.
      const computed = computeSavingsEarnings({
        totalReturns: stusdsTotalQuery.data ?? {},
        partialReturns: stusdsPartialQuery.data ?? {},
        window
      });
      return {
        id: 'stusds' as const,
        rowIds: ['stusds'],
        totalEarned: stusdsTotalQuery.data ? computed.totalEarned : gapFor(stusdsTotalQuery.error),
        earnedThisMonth: stusdsPartialQuery.data
          ? computed.earnedThisMonth
          : gapFor(stusdsPartialQuery.error),
        isLoading: stusdsTotalQuery.isLoading || stusdsPartialQuery.isLoading,
        error: stusdsTotalQuery.error ?? stusdsPartialQuery.error ?? null
      };
    })();

    return [morpho, merkl, pendle, savings, stusds];
  }, [
    connected,
    window,
    attributedTokens,
    stusdsEnabled,
    morphoQuery,
    merklRewardsQuery,
    merklClaimsQuery,
    pricesQuery,
    pendleRowsQuery,
    pendleGainedQuery,
    pendleDashboardQuery,
    savingsTotalQuery,
    savingsPartialQuery,
    stusdsTotalQuery,
    stusdsPartialQuery
  ]);

  const combined = useMemo(() => combineWalletEarnings(protocols), [protocols]);

  return useMemo(
    () => ({
      protocols,
      combined,
      isLoading: protocols.some(p => p.isLoading),
      window
    }),
    [protocols, combined, window]
  );
}
