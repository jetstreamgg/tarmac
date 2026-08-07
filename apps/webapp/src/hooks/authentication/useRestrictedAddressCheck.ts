import { useQuery } from '@tanstack/react-query';
import { ReadHookParams } from '../hooks';

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
      throw new Error('non 200 response received');
    }
  }
  return { addressAllowed };
};

type Props = ReadHookParams<AuthResponse> & {
  address?: string;
  authUrl: string;
  enabled: boolean;
};

export const useRestrictedAddressCheck = ({
  address,
  authUrl,
  enabled,
  ...options
}: Props): { data: AuthResponse | undefined; error: Error | undefined; isLoading: boolean } => {
  const { data, error, isLoading } = useQuery({
    queryKey: ['auth', address],
    enabled: !!address && enabled,
    queryFn: () => checkAddress(address, authUrl),
    ...options
  });

  return { data, error: error ?? undefined, isLoading: !data && isLoading };
};
