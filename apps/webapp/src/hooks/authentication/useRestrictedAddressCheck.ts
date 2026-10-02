import { useQuery } from '@tanstack/react-query';
import { ReadHookParams } from '../hooks';

export type AddressScreeningResult = {
  addressAllowed: boolean;
};

/**
 * How old a screening verdict may be and still clear a transaction without a
 * re-check (APP-501; the edge caches 12h, so this is the tighter bound). Also
 * the hook's staleness, so a verdict fetched before the terms serves the
 * transactions that follow them instead of being re-fetched on focus.
 */
export const SCREENING_MAX_AGE_MS = 4 * 60 * 60 * 1000;

/**
 * How often a RISKY verdict is re-checked while the tab is focused. A block is
 * the one verdict the app can't be waited out of (the blocked screen only
 * offers Disconnect), and false positives get cleared by the worker's admin
 * purge — so it is re-asked, gently. The worker caches blocked verdicts at
 * the edge for 12h like allowed ones, so these polls are cache hits: the paid
 * provider is only reached once that entry expires or is purged, which is
 * exactly when a re-screen can change the answer.
 */
export const RISKY_SCREENING_REPOLL_MS = 5 * 60 * 1000;

/**
 * One cache entry per address, shared between the hook below and the
 * pre-transaction gate (APP-501), so both read and write the same verdict: a
 * risky result found at Confirm flips the app-level blocked dialog through
 * this key, and a fresh pre-terms verdict spares Confirm a refetch.
 */
export const addressScreeningQueryKey = (address?: string) => ['auth', address];

export const fetchAddressScreening = async (
  address?: string,
  authUrl?: string
): Promise<AddressScreeningResult> => {
  if (!authUrl) {
    throw new Error('Missing auth URL');
  }
  const wholeUrl = `${authUrl}/address/status?address=${address}`;

  let addressAllowed = true;
  if (address) {
    const res = await fetch(wholeUrl);
    if (res.status === 200) {
      const data = await res.json();
      addressAllowed = data.addressAllowed;
    } else {
      throw new Error('non 200 response received');
    }
  }
  return { addressAllowed };
};

type Props = ReadHookParams<AddressScreeningResult> & {
  address?: string;
  authUrl: string;
  enabled: boolean;
};

export const useRestrictedAddressCheck = ({
  address,
  authUrl,
  enabled,
  // No polling: every screening is a billed provider call once the worker's
  // edge cache expires, and a verdict only matters at the moments that gate on
  // it (before the terms, and at Confirm — the gate re-checks a stale one).
  staleTime = SCREENING_MAX_AGE_MS,
  ...options
}: Props): {
  data: AddressScreeningResult | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refetch: () => void;
} => {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: addressScreeningQueryKey(address),
    // A cached risky verdict keeps the query live even when the caller didn't
    // ask for a fetch, so the re-poll below runs wherever the block came from
    // (the pre-transaction gate writes this key too).
    enabled: query => !!address && (enabled || query.state.data?.addressAllowed === false),
    queryFn: () => fetchAddressScreening(address, authUrl),
    staleTime,
    refetchInterval: query =>
      query.state.data?.addressAllowed === false ? RISKY_SCREENING_REPOLL_MS : false,
    ...options
  });

  return { data, error: error ?? undefined, isLoading: !data && isLoading, refetch };
};
