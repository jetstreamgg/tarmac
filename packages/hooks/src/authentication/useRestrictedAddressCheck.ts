import { useQuery } from '@tanstack/react-query';
import { ReadHookParams } from '../hooks';
import { useChainalysisCheck } from './useChainalysisCheck';
import { DEFAULT_ORACLE_CHAIN_ID } from './chainalysisOracle';

type AuthResponse = {
  addressAllowed: boolean;
};

const checkAddress = async (address?: string, authUrl?: string): Promise<AuthResponse> => {
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
      addressAllowed = false;
      throw new Error('non 200 response received');
    }
  }
  return { addressAllowed };
};

type Props = ReadHookParams<AuthResponse> & {
  address?: string;
  authUrl: string;
  enabled: boolean;
  chainId?: number;
};

export const useRestrictedAddressCheck = ({
  address,
  authUrl,
  enabled,
  chainId = DEFAULT_ORACLE_CHAIN_ID,
  ...options
}: Props): { data: AuthResponse | undefined; error: Error | undefined; isLoading: boolean } => {
  // Primary: HTTP API check
  const {
    data: httpData,
    error: httpError,
    isLoading: httpIsLoading
  } = useQuery({
    queryKey: ['auth', address],
    enabled: !!address && enabled,
    queryFn: () => checkAddress(address, authUrl),
    ...options
  });

  // Fallback: Chainalysis Oracle (only enabled if HTTP check failed)
  const {
    data: oracleData,
    error: oracleError,
    isLoading: oracleIsLoading
  } = useChainalysisCheck({
    address,
    chainId,
    enabled: enabled && !!address && !!httpError
  });

  // Use HTTP data if available, otherwise fallback to oracle data
  const data = httpError ? oracleData : httpData;

  // Only report error if both checks failed
  const error = httpError && oracleError ? oracleError : undefined;

  // Loading if HTTP is loading, or if HTTP failed and oracle is loading
  const isLoading = httpIsLoading || (!!httpError && oracleIsLoading);

  return { data, error, isLoading: !data && isLoading };
};
