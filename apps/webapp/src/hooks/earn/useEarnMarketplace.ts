import { useMemo } from 'react';
import { useChainId, useConnection, useReadContracts } from 'wagmi';
import { useQueries } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import {
  chainId as chainIdConstants,
  isTestnetId,
  calculateApyFromStr,
  formatDecimalPercentage,
  math
} from '@/utils';
import { getSupportedChainIds } from '@/data/wagmi/config/chainFamily';
import { ZERO_ADDRESS } from '../constants';
import { usdsSkyRewardAbi, sparkUsdtVaultAddress } from '../generated';
import { usePrices } from '../prices/usePrices';
import { useOverallSkyData } from '../shared/useOverallSkyData';
import { trailingAverageRate, type DailyRatePoint } from '../shared/trailingRate';
import { useMultiChainSavingsBalances } from '../savings/useMultiChainSavingsBalances';
import { useSkySavingsRateHistoricData } from '../savings/useSkySavingsRateHistoricData';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { filterDeprecatedRewardContracts } from '../rewards/deprecatedRewards';
import { useMultipleRewardsChartInfo } from '../rewards/useMultipleRewardsChartInfo';
import type { RewardsChartInfoParsed } from '../rewards/useRewardsChartInfo';
import { MORPHO_VAULTS } from '../morpho/constants';
import { useMorphoVaultMultipleRateApiData } from '../morpho/useMorphoVaultRateApiData';
import { useMorphoVaultsTrailingRates } from '../morpho/useMorphoVaultsTrailingRates';
import { fetchMorphoVaultMarketData } from '../morpho/useMorphoVaultMarketApiData';
import { useAllMorphoVaultsUserAssets } from '../morpho/useAllMorphoVaultsUserAssets';
import { VAULTS } from '../vaults/constants';
import { useSparkVaultResolvedRate } from '../vaults/spark/useSparkVaultResolvedRate';
import { useSparkVaultApiData } from '../vaults/spark/useSparkVaultApiData';
import { isMarketMatured } from '../pendle/helpers';
import { PENDLE_MARKETS } from '../pendle/constants';
import { usePendleMarketsApiData } from '../pendle/usePendleMarketsApiData';
import { fetchPendleMarketHistoricalData } from '../pendle/usePendleMarketChartData';
import { useAllPendleUserAssets } from '../pendle/useAllPendleUserAssets';
import { useStUsdsData } from '../stusds/useStUsdsData';
import { useStUsdsChartInfo } from '../stusds/useStUsdsChartInfo';
import { buildEarnProducts } from './earnProducts';
import type { EarnMarketplaceResult, EarnProductRow, EarnRate, EarnUsdAmount } from './types';

const NO_RATE = '—';

/** Window of the table's "30D Rate" column, in days. */
const TRAILING_DAYS = 30;

// Same valuation math as useSuppliedBalancesTotalUsd (which this supersedes):
// WAD amount × BA Labs price. Portfolio must consume these rows, not refork it.
const bigintToUsd = (balance: bigint, priceStr: string | undefined) =>
  (Number(balance) / 1e18) * parseFloat(priceStr || '0');

const toRate = (value: number | undefined): EarnRate =>
  value !== undefined && !isNaN(value) && value > 0
    ? { value, formatted: formatDecimalPercentage(value) }
    : { formatted: NO_RATE };

const latestChartEntry = (data?: RewardsChartInfoParsed[]): RewardsChartInfoParsed | undefined =>
  data && data.length > 0 ? [...data].sort((a, b) => b.blockTimestamp - a.blockTimestamp)[0] : undefined;

const singleChainAmount = (chainId: number, totalUsd: number): EarnUsdAmount => ({
  totalUsd,
  byChain: { [chainId]: totalUsd }
});

/**
 * The C1 marketplace aggregator: every registry product decorated with live
 * rate / TVL / user-position data, normalized to one row shape (plan §4.1,
 * Earn Opportunities table). Fetches the whole active chain family at once
 * (all production networks, or only Tenderly when forked); single-chain
 * products resolve against the family's mainnet. Every underlying hook is
 * called unconditionally over const registries, so hook order is stable.
 * Rows carry their own isLoading/error — one product's source failing does
 * not sink the table.
 */
export function useEarnMarketplace(): EarnMarketplaceResult {
  const connectedChainId = useChainId();
  const { address } = useConnection();
  const familyChainIds = getSupportedChainIds(connectedChainId);
  // Single-chain products (rewards, vaults, fixed, stUSDS) live on mainnet;
  // the Tenderly fork mirrors it under its own chain id.
  const familyMainnetId = isTestnetId(connectedChainId)
    ? chainIdConstants.tenderly
    : chainIdConstants.mainnet;

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // --- Savings (the one genuinely multichain product)
  const { data: overallSkyData, isLoading: overallLoading, error: overallError } = useOverallSkyData();
  const {
    data: savingsBalances,
    isLoading: savingsBalancesLoading,
    error: savingsBalancesError
  } = useMultiChainSavingsBalances({ chainIds: familyChainIds, address });
  // SSR is one global rate, so its daily history needs no per-chain split.
  const { data: savingsRateHistoric, isLoading: savingsRateHistoricLoading } = useSkySavingsRateHistoricData({
    daysAgo: TRAILING_DAYS
  });

  // --- Rewards: array-taking hooks keep the call count fixed regardless of
  // how many contracts the chain resolves.
  const allRewardContracts = useAvailableTokenRewardContracts(familyMainnetId);
  const rewardContracts = useMemo(
    () => filterDeprecatedRewardContracts(allRewardContracts, familyMainnetId),
    [allRewardContracts, familyMainnetId]
  );
  const {
    data: rewardsCharts,
    isLoading: rewardsChartsLoading,
    error: rewardsChartsError
  } = useMultipleRewardsChartInfo({
    rewardContractAddresses: rewardContracts.map(c => c.contractAddress)
  });
  const {
    data: rewardsBalances,
    isLoading: rewardsBalancesLoading,
    error: rewardsBalancesError
  } = useReadContracts({
    contracts: rewardContracts.map(c => ({
      address: c.contractAddress as `0x${string}`,
      abi: usdsSkyRewardAbi,
      chainId: familyMainnetId,
      functionName: 'balanceOf' as const,
      args: [address ?? ZERO_ADDRESS]
    })),
    query: { enabled: !!address }
  });

  // --- Vaults (Morpho + Spark via the unified VAULTS registry)
  const morphoVaultAddresses = useMemo(
    () => MORPHO_VAULTS.map(v => v.vaultAddress[familyMainnetId]),
    [familyMainnetId]
  );
  const {
    data: morphoRates,
    isLoading: morphoRatesLoading,
    error: morphoRatesError
  } = useMorphoVaultMultipleRateApiData({ vaultAddresses: morphoVaultAddresses });
  // Same query keys as useMorphoVaultsCombinedTvl, so the cache is shared with
  // the existing widgets and mounting both costs no extra requests.
  const morphoMarketResults = useQueries({
    queries: MORPHO_VAULTS.map(vault => ({
      queryKey: ['morpho-vault-market-data', vault.vaultAddress[mainnet.id], mainnet.id],
      queryFn: () => fetchMorphoVaultMarketData(vault.vaultAddress[mainnet.id], mainnet.id),
      staleTime: 30_000,
      gcTime: 60_000
    }))
  });
  // Trailing rates come from the Morpho historical API in a single request for
  // all vaults; the Spark vault carries its own daily series inside
  // `sparkMarket.data.history`, so it needs no extra fetch.
  const morphoVaultAddressesForHistory = useMemo(
    () => morphoVaultAddresses.filter((address): address is `0x${string}` => !!address),
    [morphoVaultAddresses]
  );
  const { data: morphoTrailingRates, isLoading: morphoTrailingRatesLoading } = useMorphoVaultsTrailingRates({
    vaultAddresses: morphoVaultAddressesForHistory,
    days: TRAILING_DAYS
  });
  const sparkRate = useSparkVaultResolvedRate({ vaultAddress: sparkUsdtVaultAddress[mainnet.id] });
  const sparkMarket = useSparkVaultApiData({ vaultAddress: sparkUsdtVaultAddress[mainnet.id] });
  // Despite the name, iterates the unified VAULTS registry (Morpho + Spark).
  const {
    data: vaultUserAssets,
    isLoading: vaultUserAssetsLoading,
    error: vaultUserAssetsError
  } = useAllMorphoVaultsUserAssets();

  // --- Pendle
  const {
    data: pendleMarketsApi,
    isLoading: pendleMarketsLoading,
    error: pendleMarketsError
  } = usePendleMarketsApiData();
  const {
    data: pendleUserAssets,
    isLoading: pendleUserAssetsLoading,
    error: pendleUserAssetsError
  } = useAllPendleUserAssets();
  // Daily implied-APY series per live market — the trailing average of the
  // market's fixed rate. Same query key as the detail chart, so opening a
  // market from the table costs no extra request.
  const livePendleMarkets = useMemo(
    () => PENDLE_MARKETS.filter(market => !isMarketMatured(market.expiry)),
    []
  );
  const pendleChartResults = useQueries({
    queries: livePendleMarkets.map(market => ({
      queryKey: ['pendle-market-historical-data', market.marketAddress],
      queryFn: () => fetchPendleMarketHistoricalData(market.marketAddress),
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false
    }))
  });

  // --- stUSDS
  const { data: stUsdsData, isLoading: stUsdsLoading, error: stUsdsError } = useStUsdsData();
  const { data: stUsdsChart, isLoading: stUsdsChartLoading } = useStUsdsChartInfo();

  const products = useMemo(
    () => buildEarnProducts(familyChainIds, familyMainnetId, rewardContracts),
    [familyChainIds, familyMainnetId, rewardContracts]
  );

  const rows = useMemo<EarnProductRow[]>(() => {
    const trailing = (points: DailyRatePoint[]) => toRate(trailingAverageRate(points, TRAILING_DAYS));
    // SSR history is one series for every chain the savings row spans.
    const savingsRate30d = trailing(
      (savingsRateHistoric ?? []).map(point => ({
        rate: parseFloat(point.rate),
        timestampSec: point.blockTimestamp
      }))
    );
    const stUsdsRate30d = trailing(
      (stUsdsChart ?? []).flatMap(point =>
        point.rate !== undefined
          ? [{ rate: parseFloat(formatUnits(point.rate, 18)), timestampSec: point.blockTimestamp }]
          : []
      )
    );

    const usdsPrice = pricesData?.USDS?.price;
    const priceFor = (symbol: string) => pricesData?.[symbol]?.price ?? usdsPrice;
    // Disconnected → position undefined on EVERY row (some sources report 0n
    // without an account, which would render as a misleading $0). Connected →
    // a number on every row, 0 included.
    const connected = !!address;

    return products
      .filter(product => product.maturity === undefined || !isMarketMatured(product.maturity))
      .map(product => {
        switch (product.kind) {
          case 'savings': {
            const rawRate = overallSkyData?.skySavingsRatecRate;
            const rawTvl = overallSkyData?.skySavingsRateTvl;
            const byChain = Object.fromEntries(
              Object.entries(savingsBalances ?? {}).map(([id, balance]) => [
                id,
                bigintToUsd(balance, usdsPrice)
              ])
            );
            return {
              ...product,
              rate: toRate(rawRate ? parseFloat(rawRate) : undefined),
              rate30d: savingsRate30d,
              // BA Labs reports savings TVL as a global USD figure — no per-chain split.
              tvl: rawTvl ? { totalUsd: parseFloat(rawTvl) } : undefined,
              position:
                connected && savingsBalances
                  ? {
                      totalUsd: Object.values(byChain).reduce((acc, usd) => acc + usd, 0),
                      byChain
                    }
                  : undefined,
              isLoading:
                overallLoading || savingsBalancesLoading || savingsRateHistoricLoading || pricesLoading,
              error: overallError || savingsBalancesError || null
            };
          }
          case 'rewards': {
            const index = rewardContracts.findIndex(c => c.contractAddress === product.address);
            const latest = latestChartEntry(rewardsCharts?.[index]);
            const supplied = rewardsBalances?.[index]?.result as bigint | undefined;
            const suppliedUsd =
              connected && supplied !== undefined ? bigintToUsd(supplied, usdsPrice) : undefined;
            const tvlUsd = latest
              ? parseFloat(latest.totalSupplied) * parseFloat(usdsPrice || '0')
              : undefined;
            return {
              ...product,
              rate: toRate(latest ? parseFloat(latest.rate) : undefined),
              // The farm's own daily series is already in hand — no extra fetch.
              // Points farms (Chronicle) report a 0 rate and stay dashed.
              rate30d: trailing(
                (rewardsCharts?.[index] ?? []).map(point => ({
                  rate: parseFloat(point.rate),
                  timestampSec: point.blockTimestamp
                }))
              ),
              tvl: tvlUsd !== undefined ? singleChainAmount(familyMainnetId, tvlUsd) : undefined,
              position:
                suppliedUsd !== undefined ? singleChainAmount(familyMainnetId, suppliedUsd) : undefined,
              isLoading: rewardsChartsLoading || rewardsBalancesLoading || pricesLoading,
              error: rewardsChartsError || rewardsBalancesError || null
            };
          }
          case 'vault': {
            const vault = VAULTS.find(v => v.vaultAddress[familyMainnetId] === product.address);
            const isSpark = vault?.provider === 'sky';
            let rate: EarnRate;
            let rate30d: EarnRate;
            let tvlUsd: number | undefined;
            if (isSpark) {
              rate = toRate(
                sparkRate.formattedRate !== undefined ? parseFloat(sparkRate.formattedRate) / 100 : undefined
              );
              // Spark's API returns its daily series alongside the current
              // figures, so the history is already loaded here.
              rate30d = trailing(
                (sparkMarket.data?.history ?? []).flatMap(point =>
                  point.apy !== undefined ? [{ rate: point.apy, timestampSec: point.blockTimestamp }] : []
                )
              );
              tvlUsd = sparkMarket.data?.totalAssetsUsd;
              if (tvlUsd === undefined && sparkMarket.data?.totalAssets !== undefined && vault) {
                const decimals = math.resolveDecimals(vault.assetToken.decimals, mainnet.id);
                tvlUsd = bigintToUsd(
                  math.scaleToBaseDecimals(sparkMarket.data.totalAssets, decimals),
                  priceFor(vault.assetToken.symbol)
                );
              }
            } else {
              const morphoRate = morphoRates?.find(
                r => r.address.toLowerCase() === product.address?.toLowerCase()
              );
              rate = toRate(morphoRate?.netRate);
              // Already averaged by the hook (one request covers every vault).
              rate30d = toRate(
                product.address ? morphoTrailingRates?.[product.address.toLowerCase()] : undefined
              );
              const morphoIndex = MORPHO_VAULTS.findIndex(
                v => v.vaultAddress[familyMainnetId] === product.address
              );
              tvlUsd = morphoMarketResults[morphoIndex]?.data?.totalAssetsUsd;
            }
            const userVault = vaultUserAssets.vaults.find(v => v.vaultAddress === product.address);
            const positionUsd =
              connected && userVault
                ? bigintToUsd(userVault.balanceNormalized, priceFor(userVault.assetToken.symbol))
                : undefined;
            return {
              ...product,
              rate,
              rate30d,
              tvl: tvlUsd !== undefined ? singleChainAmount(familyMainnetId, tvlUsd) : undefined,
              position:
                positionUsd !== undefined ? singleChainAmount(familyMainnetId, positionUsd) : undefined,
              isLoading:
                (isSpark
                  ? sparkRate.isLoading || sparkMarket.isLoading
                  : morphoRatesLoading ||
                    morphoTrailingRatesLoading ||
                    morphoMarketResults.some(r => r.isLoading)) ||
                vaultUserAssetsLoading ||
                pricesLoading,
              error: (isSpark ? sparkMarket.error : morphoRatesError) || vaultUserAssetsError || null
            };
          }
          case 'fixed': {
            const stats = product.address ? pendleMarketsApi?.[product.address] : undefined;
            const userMarket = pendleUserAssets.markets.find(m => m.marketAddress === product.address);
            const chartIndex = livePendleMarkets.findIndex(m => m.marketAddress === product.address);
            return {
              ...product,
              rate: toRate(stats?.impliedApy),
              // Trailing average of the market's implied (fixed) APY — how the
              // rate on offer has moved, not what an existing position earns:
              // a supplied position is locked at its own rate until maturity.
              rate30d: trailing(
                (pendleChartResults[chartIndex]?.data ?? []).flatMap(point =>
                  point.impliedApy !== undefined
                    ? [{ rate: point.impliedApy, timestampSec: point.timestampSec }]
                    : []
                )
              ),
              tvl: stats?.tvl !== undefined ? singleChainAmount(familyMainnetId, stats.tvl) : undefined,
              // The pendle breakdown only lists markets with a non-zero PT
              // balance — connected users with none still get an explicit 0.
              position: connected
                ? singleChainAmount(familyMainnetId, userMarket?.valuationUsd ?? 0)
                : undefined,
              isLoading:
                pendleMarketsLoading ||
                pendleUserAssetsLoading ||
                (pendleChartResults[chartIndex]?.isLoading ?? false),
              error: pendleMarketsError || pendleUserAssetsError || null
            };
          }
          case 'stusds': {
            return {
              ...product,
              rate: toRate(
                stUsdsData?.moduleRate !== undefined
                  ? calculateApyFromStr(stUsdsData.moduleRate) / 100
                  : undefined
              ),
              rate30d: stUsdsRate30d,
              tvl:
                stUsdsData?.totalAssets !== undefined
                  ? singleChainAmount(familyMainnetId, bigintToUsd(stUsdsData.totalAssets, usdsPrice))
                  : undefined,
              position:
                connected && stUsdsData?.userSuppliedUsds !== undefined
                  ? singleChainAmount(familyMainnetId, bigintToUsd(stUsdsData.userSuppliedUsds, usdsPrice))
                  : undefined,
              isLoading: stUsdsLoading || stUsdsChartLoading || pricesLoading,
              error: stUsdsError || null
            };
          }
        }
      });
  }, [
    products,
    address,
    pricesData,
    pricesLoading,
    overallSkyData,
    overallLoading,
    overallError,
    savingsBalances,
    savingsBalancesLoading,
    savingsBalancesError,
    savingsRateHistoric,
    savingsRateHistoricLoading,
    rewardContracts,
    rewardsCharts,
    rewardsChartsLoading,
    rewardsChartsError,
    rewardsBalances,
    rewardsBalancesLoading,
    rewardsBalancesError,
    morphoRates,
    morphoRatesLoading,
    morphoRatesError,
    morphoTrailingRates,
    morphoTrailingRatesLoading,
    morphoMarketResults,
    sparkRate,
    sparkMarket,
    vaultUserAssets,
    vaultUserAssetsLoading,
    vaultUserAssetsError,
    pendleMarketsApi,
    pendleMarketsLoading,
    pendleMarketsError,
    pendleUserAssets,
    pendleUserAssetsLoading,
    pendleUserAssetsError,
    livePendleMarkets,
    pendleChartResults,
    stUsdsData,
    stUsdsLoading,
    stUsdsError,
    stUsdsChart,
    stUsdsChartLoading,
    familyMainnetId
  ]);

  return {
    rows,
    isLoading: rows.some(row => row.isLoading),
    // Every source a row's `position` reads from — balances plus the prices
    // that turn them into USD. Rate/TVL/chart sources (the slow external
    // APIs) deliberately excluded.
    isPositionsLoading:
      pricesLoading ||
      savingsBalancesLoading ||
      rewardsBalancesLoading ||
      vaultUserAssetsLoading ||
      pendleUserAssetsLoading ||
      stUsdsLoading,
    totalDepositedUsd: rows.reduce((acc, row) => acc + (row.position?.totalUsd ?? 0), 0)
  };
}
