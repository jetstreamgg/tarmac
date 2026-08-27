import { useConnection } from 'wagmi';
import {
  TOKENS,
  useEarnMarketplace,
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  useNetworkFilter,
  usePrices,
  useStakeRewardContracts,
  useTokenBalances,
  type TokenItem
} from '@/hooks';
import { useGeoConfig } from '@/modules/geo-config';
import { buildIdleSupplyInfo } from '@/modules/portfolio/helpers/idleView';
import { useGeoVisibleRows } from '@/modules/portfolio/hooks/useGeoVisibleRows';

/**
 * The fixed set of tokens surfaced in the drawer's Assets tab, in display
 * order. The registry `name` field only holds the short symbol, so the
 * display names live here (same convention as the Portfolio idle view).
 */
const DRAWER_ASSETS = [
  { symbol: 'USDS', name: 'Sky USD' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'USDT', name: 'Tether USD' },
  { symbol: 'SKY', name: 'Sky Token' }
] as const;

const ASSET_SYMBOLS = DRAWER_ASSETS.map(a => a.symbol) as readonly string[];
// Registry definitions (address-per-chain), resolved by symbol so we never
// couple to TOKENS' internal keys.
const ASSET_TOKENS = Object.values(TOKENS).filter(token => ASSET_SYMBOLS.includes(token.symbol));

export type WalletDrawerAsset = {
  symbol: string;
  /** Full display name, e.g. 'Sky USD'. */
  name: string;
  /** Balance in token units, summed across the active chain family. */
  amount: number;
  amountUsd: number;
  /** Best available earn rate (decimal fraction); undefined when no venue has a rate. */
  bestRate?: number;
  /** Whether more than one venue accepts the token, i.e. the rate reads "up to". */
  multipleVenues: boolean;
  /** Whether the region leaves the token anywhere to earn — gates the Start-earning CTA. */
  canEarn: boolean;
};

export type UseWalletDrawerAssetsResult = {
  /** Every drawer asset, zero balances included, sorted by USD value descending. */
  assets: WalletDrawerAsset[];
  /** Σ of the assets' USD values — the headline figure in the drawer header. */
  totalUsd: number;
  isLoading: boolean;
};

/**
 * Wallet balances for the drawer's Assets tab: USDS/USDC/USDT/SKY across the
 * active chain family, valued in USD, decorated with the best earn rate per
 * token. Stablecoin rates come from the Earn marketplace (same source as the
 * Portfolio idle view); SKY earns through staking, so its rate is the highest
 * stake reward rate.
 *
 * Scoped by the app-wide network filter, which is the control sitting directly
 * beside this total in the drawer header — the two have to agree.
 */
export function useWalletDrawerAssets(): UseWalletDrawerAssetsResult {
  const { address } = useConnection();
  const { chainId: networkFilter, supportedChainIds } = useNetworkFilter();
  const chainIds = networkFilter === null ? supportedChainIds : [networkFilter];

  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  // Only request a token on chains where it has an address.
  const chainTokenMap: Record<number, TokenItem[]> = {};
  for (const id of chainIds) {
    const tokens: TokenItem[] = ASSET_TOKENS.map(token => ({
      address: token.address[id],
      symbol: token.symbol
    })).filter(token => !!token.address);
    if (tokens.length > 0) chainTokenMap[id] = tokens;
  }
  const { data: rawBalances, isLoading: balancesLoading } = useTokenBalances({ address, chainTokenMap });

  // Rates and venue counts come from the venues available in this region —
  // the same geo-filtered rows the portfolio idle table quotes — so a
  // restricted region sees the best rate it can actually access rather than
  // no rates at all.
  const { rows } = useEarnMarketplace();
  const visibleRows = useGeoVisibleRows(rows);
  const supplyInfo = buildIdleSupplyInfo(visibleRows);
  const { isModuleEnabled, isLoading: isGeoLoading } = useGeoConfig();
  // Same loading default as useGeoVisibleRows: available until the config says
  // otherwise, so the CTA doesn't blank for everyone while it loads.
  const stakeAvailable = isGeoLoading || isModuleEnabled('stake');

  const { data: stakeRewardContracts } = useStakeRewardContracts();
  const { data: stakeChartsData } = useMultipleRewardsChartInfo({
    rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) || []
  });
  const highestStakeRateData = useHighestRateFromChartData(stakeChartsData || []);
  const stakeRate = parseFloat(highestStakeRateData?.rate || '0');
  // Only count stake contracts that have actual rate data > 0.
  const stakeVenueCount = (stakeChartsData || []).filter(chartData => {
    if (!chartData || chartData.length === 0) return false;
    const mostRecent = chartData.reduce((latest, current) =>
      current.blockTimestamp > latest.blockTimestamp ? current : latest
    );
    return parseFloat(mostRecent?.rate || '0') > 0;
  }).length;

  // BA Labs price per symbol; stablecoins fall back to the USDS price the same
  // way the Earn marketplace does. SKY gets no stable fallback.
  const usdsPrice = pricesData?.USDS?.price;
  const priceFor = (symbol: string) =>
    pricesData?.[symbol]?.price ?? (symbol === 'SKY' ? undefined : usdsPrice);

  const bySymbol = new Map<string, { amount: number; amountUsd: number }>();
  for (const balance of rawBalances ?? []) {
    const amount = parseFloat(balance.formatted);
    const entry = bySymbol.get(balance.symbol) ?? { amount: 0, amountUsd: 0 };
    entry.amount += amount;
    entry.amountUsd += amount * parseFloat(priceFor(balance.symbol) || '0');
    bySymbol.set(balance.symbol, entry);
  }

  const assets: WalletDrawerAsset[] = DRAWER_ASSETS.map(({ symbol, name }) => {
    const entry = bySymbol.get(symbol) ?? { amount: 0, amountUsd: 0 };
    const rateInfo =
      symbol === 'SKY'
        ? {
            bestRate: stakeAvailable && stakeRate > 0 ? stakeRate : undefined,
            venueCount: stakeAvailable ? stakeVenueCount : 0,
            // Module-gated rather than venue-counted: the venue count only
            // materializes once the stake chart data lands.
            canEarn: stakeAvailable
          }
        : {
            bestRate: supplyInfo.get(symbol)?.bestRate,
            venueCount: supplyInfo.get(symbol)?.venueCount ?? 0,
            canEarn: (supplyInfo.get(symbol)?.venueCount ?? 0) > 0
          };
    return {
      symbol,
      name,
      amount: entry.amount,
      amountUsd: entry.amountUsd,
      bestRate: rateInfo.bestRate,
      multipleVenues: rateInfo.venueCount > 1,
      canEarn: rateInfo.canEarn
    };
  }).sort((a, b) => b.amountUsd - a.amountUsd);

  return {
    assets,
    totalUsd: assets.reduce((acc, asset) => acc + asset.amountUsd, 0),
    isLoading: balancesLoading || pricesLoading
  };
}
