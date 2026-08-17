import { useQuery } from '@tanstack/react-query';
import { ReadHookParams } from '../hooks';

export type AddressScreeningResult = {
  addressAllowed: boolean;
};

/**
 * One cache entry per address, shared between the connect-time hook below and
 * the pre-transaction gate (APP-501), so both read and write the same verdict:
 * a risky result found at Confirm flips the app-level blocked dialog through
 * this key, and a fresh connect-time verdict spares Confirm a refetch.
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
  staleTime = 60000, // a verdict stays fresh for 60 seconds, so tab focus doesn't refetch on every switch
  refetchInterval = 60000, // re-check every 60 seconds, matching useVpnCheck, so an error state can recover
  ...options
}: Props): {
  data: AddressScreeningResult | undefined;
  error: Error | undefined;
  isLoading: boolean;
  refetch: () => void;
} => {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: addressScreeningQueryKey(address),
    enabled: !!address && enabled,
    queryFn: () => fetchAddressScreening(address, authUrl),
    staleTime,
    refetchInterval,
    ...options
  });

  return { data, error: error ?? undefined, isLoading: !data && isLoading, refetch };
};
