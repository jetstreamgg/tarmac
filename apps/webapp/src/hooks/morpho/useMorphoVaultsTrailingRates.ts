import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { trailingAverageRate, type DailyRatePoint } from '../shared/trailingRate';
import { MORPHO_API_CHAIN_ID, MORPHO_API_URL, buildVaultV2ApyWindowQuery } from './constants';

const DAY_IN_SECONDS = 86400;

type ApyWindowResponse = {
  data?: Record<
    string,
    {
      address: string;
      historicalState: { avgNetApy: Array<{ x: number; y: number | null }> };
    } | null
  >;
};

/** Trailing average net APY (decimal fraction) keyed by lowercased vault address. */
export type MorphoTrailingRates = Record<string, number>;

async function fetchMorphoVaultsTrailingRates(
  vaultAddresses: `0x${string}`[],
  chainId: number,
  days: number
): Promise<MorphoTrailingRates> {
  const endTimestamp = Math.floor(Date.now() / 1000);
  // One extra day of slack so a partial current-day bucket can't shorten the window.
  const startTimestamp = endTimestamp - (days + 1) * DAY_IN_SECONDS;

  const variables: Record<string, unknown> = { chainId, startTimestamp, endTimestamp };
  vaultAddresses.forEach((address, index) => {
    variables[`a${index}`] = address.toLowerCase();
  });

  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: buildVaultV2ApyWindowQuery(vaultAddresses.length), variables })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: ApyWindowResponse = await response.json();

  const rates: MorphoTrailingRates = {};
  vaultAddresses.forEach((address, index) => {
    const vault = result.data?.[`v${index}`];
    if (!vault) return;
    const points: DailyRatePoint[] = vault.historicalState.avgNetApy
      .filter((point): point is { x: number; y: number } => point.y !== null)
      .map(point => ({ rate: point.y, timestampSec: point.x }));
    const average = trailingAverageRate(points, days);
    if (average !== undefined) rates[address.toLowerCase()] = average;
  });

  return rates;
}

export type MorphoVaultsTrailingRatesHook = ReadHook & {
  data?: MorphoTrailingRates;
};

/**
 * Trailing average net APY for several Morpho V2 vaults — the marketplace
 * table's "30D Rate" column. Every vault resolves in one request (see
 * `buildVaultV2ApyWindowQuery`), and the average is computed here so callers
 * only ever see a finished number.
 *
 * Morpho vaults are mainnet-only, so the chainId is pinned and the cache
 * survives network switches, matching the other Morpho API hooks.
 */
export function useMorphoVaultsTrailingRates({
  vaultAddresses,
  days = 30
}: {
  vaultAddresses: `0x${string}`[];
  days?: number;
}): MorphoVaultsTrailingRatesHook {
  const chainId = MORPHO_API_CHAIN_ID;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vaults-trailing-rates', ...vaultAddresses, chainId, days],
    queryFn: () => fetchMorphoVaultsTrailingRates(vaultAddresses, chainId, days),
    enabled: vaultAddresses.length > 0,
    // The window only moves once a day; keep it out of the way of the live-rate
    // refetches this table already runs.
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate,
    dataSources: [
      {
        title: 'Morpho API',
        href: MORPHO_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
