import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, type Address } from 'viem';
import { useConnection } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { createProxyTransport } from '@/data/wagmi/config/proxyTransport';
import { usdsFlagshipVaultAddress } from '../../../hooks/generated';
import { findFirstBlockAtOrAfter } from '../../../hooks/helpers/findFirstBlockAtOrAfter';
import { MORPHO_VAULTS } from '../../../hooks/morpho/constants';
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
import { usePrices } from '../../../hooks/prices/usePrices';
import { isDeprecatedRewardContract } from '../../../hooks/rewards/deprecatedRewards';
import { fetchRewardFarmClaims, fetchRewardFarmEarned } from '../../../hooks/rewards/rewardFarmEarnedClient';
import { rewardContractDisplayName } from '../../../hooks/rewards/rewardContractDisplayName';
import { createRewardContracts } from '../../../hooks/rewards/useAvailableTokenRewardContracts';
import { TOKENS } from '../../../hooks/tokens/tokens.constants';
import { STUSDS_VAULT_ID_MAINNET, SUSDS_VAULT_ID_MAINNET } from '../../../hooks/vaults/fyi/constants';
import {
  fetchVaultsFyiPartialReturns,
  fetchVaultsFyiTotalReturns
} from '../../../hooks/vaults/fyi/vaultsFyiClient';
import { combineWalletEarnings } from '../earnings/combineWalletEarnings';
import { attributedRewardTokenAddresses, computeMerklEarnings } from '../earnings/computeMerklEarnings';
import { computeMorphoEarnings } from '../earnings/computeMorphoEarnings';
import { computePendleEarnings } from '../earnings/computePendleEarnings';
import { computeRewardFarmMonth, computeRewardFarmTotal } from '../earnings/computeRewardFarmEarnings';
import { computeSavingsEarnings } from '../earnings/computeSavingsEarnings';
import { monthToDateWindow } from '../earnings/monthWindow';
import {
  morphoVaultSourceId,
  notAvailable,
  rewardFarmSourceId,
  type ProtocolEarnings,
  type WalletEarnings
} from '../earnings/types';

const FLAGSHIP = usdsFlagshipVaultAddress[mainnet.id];
const FLAGSHIP_ROW_ID = `vault-morpho-${FLAGSHIP.toLowerCase()}`;
const PENDLE_ROW_IDS = PENDLE_MARKETS.map(m => `fixed-${m.marketAddress.toLowerCase()}`);

/**
 * Every supported Morpho vault gets its own earnings source (Kuba 2026-08-21:
 * ship per-vault PnL; Merkl attribution stays Flagship-only, which the
 * non-Flagship entries announce via the 'rewards-not-included' coverage note).
 */
const MORPHO_MAINNET_VAULTS = MORPHO_VAULTS.flatMap(v => {
  const address = v.vaultAddress[mainnet.id];
  return address ? [{ address, name: v.name }] : [];
});
const MORPHO_VAULT_ADDRESSES = MORPHO_MAINNET_VAULTS.map(v => v.address);

/**
 * Every live, USD-priced Sky Token Rewards farm gets its own earnings source
 * (APP-589), so a farm added to the rewards config is tracked without touching
 * this file. Deprecated farms (SKY) and points farms (Chronicle) are left out:
 * their rows render as "Not tracked".
 */
const REWARD_FARMS = createRewardContracts(mainnet.id)
  .filter(
    c =>
      c.rewardToken.symbol !== TOKENS.cle.symbol && !isDeprecatedRewardContract(c.contractAddress, mainnet.id)
  )
  .map(c => {
    const { symbol, decimals } = c.rewardToken;
    return {
      address: c.contractAddress as Address,
      name: rewardContractDisplayName(c),
      rowId: `rewards-${symbol.toLowerCase()}`,
      token: {
        symbol,
        decimals: typeof decimals === 'number' ? decimals : decimals[mainnet.id],
        address: c.rewardToken.address[mainnet.id].toLowerCase()
      }
    };
  });
const REWARD_FARM_ADDRESSES = REWARD_FARMS.map(f => f.address);
const REWARD_TOKEN_ADDRESSES = [...new Set(REWARD_FARMS.map(f => f.token.address))].sort();

/**
 * Farm balances are read straight from mainnet through the Sky proxy rather
 * than the wagmi config: dev and e2e configs only carry the Tenderly fork,
 * and every other earnings source is mainnet-scoped too.
 */
const mainnetClient = createPublicClient({ chain: mainnet, transport: createProxyTransport(mainnet.id) });

const MORPHO_STALE_MS = 10 * 60_000;
const MERKL_REWARDS_STALE_MS = 10 * 60_000;
const MERKL_CLAIMS_STALE_MS = 60 * 60_000;
const BA_PRICES_STALE_MS = 24 * 60 * 60_000;
const PENDLE_STALE_MS = 5 * 60_000;
const VAULTS_FYI_STALE_MS = 45 * 60_000;
const REWARD_FARM_STALE_MS = 5 * 60_000;

/** The transient not-yet-settled gap: 'source-error' once the query failed, 'loading' before. */
const gapFor = (error: unknown) => notAvailable(error ? 'source-error' : 'loading');

const MAX_TIMEOUT_MS = 2 ** 31 - 1; // setTimeout clamps beyond this (~24.8 days)

/**
 * The Morpho history fetch starts one DAY-interval bucket before the window so
 * a position that predates the month always yields a baseline sample at or
 * before startSec, even if the API ever stops emitting a bucket exactly on the
 * requested start (today it does — verified live 2026-08-24). Without one, the
 * compute layer would have to choose between baseline 0 (the whole balance
 * masquerading as monthly earnings — post-merge review finding #1) and a dash.
 * The transactions fetch stays at startSec: flows must be strictly in-window.
 */
const MORPHO_BASELINE_HEADROOM_SEC = 86400;

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
 * every supported Morpho vault, Merkl rewards, Pendle PT-sUSDS, sUSDS savings,
 * stUSDS and the Sky Token Rewards farms (APP-589). Each source runs its own queries with its own
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
          startTimestamp: window.startSec - MORPHO_BASELINE_HEADROOM_SEC,
          endTimestamp
        }),
        fetchVaultV2TransactionsSince({
          userAddress: address!,
          chainId,
          vaultAddresses: MORPHO_VAULT_ADDRESSES,
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
  // its own vaultId (their holder indexing went live 2026-08-21).
  const stusdsTotalQuery = useQuery({
    queryKey: ['wallet-earnings', 'stusds-total', user],
    queryFn: () => fetchVaultsFyiTotalReturns({ userAddress: address!, vaultId: STUSDS_VAULT_ID_MAINNET }),
    enabled: connected,
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
    enabled: connected,
    staleTime: VAULTS_FYI_STALE_MS,
    refetchOnWindowFocus: false
  });

  const farmsEnabled = connected && REWARD_FARMS.length > 0;

  const farmClaimsQuery = useQuery({
    queryKey: ['wallet-earnings', 'reward-farm-claims', user],
    queryFn: () =>
      fetchRewardFarmClaims({ userAddress: address!, farmAddresses: REWARD_FARM_ADDRESSES, chainId }),
    enabled: farmsEnabled,
    staleTime: REWARD_FARM_STALE_MS
  });

  // Same staleness as the claims so the two halves of the total age together.
  const farmEarnedNowQuery = useQuery({
    queryKey: ['wallet-earnings', 'reward-farm-earned', user],
    queryFn: () =>
      fetchRewardFarmEarned({
        client: mainnetClient,
        userAddress: address!,
        farmAddresses: REWARD_FARM_ADDRESSES
      }),
    enabled: farmsEnabled,
    staleTime: REWARD_FARM_STALE_MS
  });

  // Global per month, so it is resolved once per session and never refetched;
  // the key rolls over with startSec. Kept as a string: query keys are hashed
  // with JSON.stringify, which throws on bigint.
  const monthStartBlockQuery = useQuery({
    queryKey: ['wallet-earnings', 'month-start-block', startSec],
    queryFn: async () => (await findFirstBlockAtOrAfter(mainnetClient, window.startSec)).toString(),
    enabled: farmsEnabled,
    staleTime: Infinity
  });

  // The unclaimed balance the month began with: the state after the block
  // before the first in-window block, matching the block-based claim split.
  const monthStartBlock = monthStartBlockQuery.data;
  const farmEarnedAtStartQuery = useQuery({
    queryKey: ['wallet-earnings', 'reward-farm-earned-at', user, monthStartBlock],
    queryFn: () =>
      fetchRewardFarmEarned({
        client: mainnetClient,
        userAddress: address!,
        farmAddresses: REWARD_FARM_ADDRESSES,
        blockNumber: BigInt(monthStartBlock!) - 1n
      }),
    enabled: farmsEnabled && monthStartBlock !== undefined,
    staleTime: Infinity
  });

  const farmHistoricPricesQuery = useQuery({
    queryKey: ['wallet-earnings', 'ba-historic-prices', REWARD_TOKEN_ADDRESSES.join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        REWARD_TOKEN_ADDRESSES.map(
          async token => [token, await fetchBaLabsHistoricDailyPrices({ tokenAddress: token })] as const
        )
      );
      return new Map(entries);
    },
    enabled: farmsEnabled,
    staleTime: BA_PRICES_STALE_MS
  });

  // The app-wide price cache (the portfolio's balances already load it).
  const { data: currentPrices, isLoading: currentPricesLoading, error: currentPricesError } = usePrices();

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
        ...MORPHO_MAINNET_VAULTS.map(v => ({
          ...entry(morphoVaultSourceId(v.address), [`vault-morpho-${v.address.toLowerCase()}`]),
          label: v.name
        })),
        entry('merkl', [FLAGSHIP_ROW_ID]),
        entry('pendle', PENDLE_ROW_IDS),
        entry('savings', ['savings']),
        entry('stusds', ['stusds']),
        ...REWARD_FARMS.map(f => ({ ...entry(rewardFarmSourceId(f.address), [f.rowId]), label: f.name }))
      ];
    }

    const morphoVaults: ProtocolEarnings[] = MORPHO_MAINNET_VAULTS.map(v => {
      const isFlagship = v.address.toLowerCase() === FLAGSHIP.toLowerCase();
      return {
        id: morphoVaultSourceId(v.address),
        label: v.name,
        rowIds: [`vault-morpho-${v.address.toLowerCase()}`],
        ...(morphoQuery.data
          ? computeMorphoEarnings({ ...morphoQuery.data, vaultAddress: v.address, window })
          : { totalEarned: gapFor(morphoQuery.error), earnedThisMonth: gapFor(morphoQuery.error) }),
        // Non-Flagship vaults ship PnL without their Merkl rewards for now —
        // announce the gap on the row instead of silently under-counting.
        ...(isFlagship ? {} : { coverage: 'rewards-not-included' as const }),
        isLoading: morphoQuery.isLoading,
        error: morphoQuery.error ?? null
      };
    });

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

    // The lifetime figure needs claims, the unclaimed balance and both price
    // feeds; the monthly one additionally needs the month-start balance. The
    // source reports loading on the lifetime queries only: the month figure
    // stays 'loading' on its own, which the combined month stat waits for, so
    // the slow block search never holds back the total.
    const currentPricesQuery = { isLoading: currentPricesLoading, error: currentPricesError };
    const totalQueries = [farmClaimsQuery, farmEarnedNowQuery, farmHistoricPricesQuery, currentPricesQuery];
    const monthQueries = [...totalQueries, monthStartBlockQuery, farmEarnedAtStartQuery];
    const totalError = totalQueries.find(q => q.error)?.error ?? null;
    const monthError = monthQueries.find(q => q.error)?.error ?? null;

    const rewardFarms: ProtocolEarnings[] = REWARD_FARMS.map(farm => {
      const rawPrice = currentPrices?.[farm.token.symbol]?.price;
      const currentPrice = rawPrice === undefined ? undefined : Number(rawPrice);
      const historicPrices = farmHistoricPricesQuery.data?.get(farm.token.address);
      const earnedNow = farmEarnedNowQuery.data?.get(farm.address.toLowerCase());
      const earnedAtMonthStart = farmEarnedAtStartQuery.data?.get(farm.address.toLowerCase());
      const claims = farmClaimsQuery.data?.filter(c => c.farm === farm.address.toLowerCase());

      // The current price only values the unclaimed balance (claims use their
      // day's price). A token the feed doesn't list (a brand-new farm) with a
      // balance can't be valued: an error-class gap, never a silent $0. With
      // nothing unclaimed the price isn't needed at all.
      const priceMissing = currentPrices !== undefined && !Number.isFinite(currentPrice);
      const ready = claims !== undefined && earnedNow !== undefined && historicPrices !== undefined;
      const unpriceable = priceMissing && ready && earnedNow > 0n;
      const base = {
        claims: claims ?? [],
        earnedNow: earnedNow ?? 0n,
        historicPrices: historicPrices ?? new Map<string, number>(),
        currentPrice: Number.isFinite(currentPrice) ? currentPrice! : 0,
        token: farm.token
      };
      const totalReady = ready && currentPrices !== undefined;

      const totalEarned = unpriceable
        ? notAvailable('source-error')
        : totalReady
          ? computeRewardFarmTotal(base)
          : gapFor(totalError);
      const earnedThisMonth = unpriceable
        ? notAvailable('source-error')
        : totalReady && monthStartBlock !== undefined && earnedAtMonthStart !== undefined
          ? computeRewardFarmMonth({
              ...base,
              earnedAtMonthStart,
              monthStartBlock: BigInt(monthStartBlock),
              window
            })
          : gapFor(monthError);

      return {
        id: rewardFarmSourceId(farm.address),
        label: farm.name,
        rowIds: [farm.rowId],
        totalEarned,
        earnedThisMonth,
        isLoading: totalQueries.some(q => q.isLoading),
        error: monthError
      };
    });

    return [...morphoVaults, merkl, pendle, savings, stusds, ...rewardFarms];
  }, [
    connected,
    window,
    attributedTokens,
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
    stusdsPartialQuery,
    farmClaimsQuery,
    farmEarnedNowQuery,
    monthStartBlockQuery,
    monthStartBlock,
    farmEarnedAtStartQuery,
    farmHistoricPricesQuery,
    currentPrices,
    currentPricesLoading,
    currentPricesError
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
