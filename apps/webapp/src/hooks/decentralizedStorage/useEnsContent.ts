import { ReadHook } from '../hooks';
import { useEnsResolver } from 'wagmi';
import { TrustLevelEnum, TRUST_LEVELS, TENDERLY_CHAIN_ID } from '../constants';
import { useQuery } from '@tanstack/react-query';

type UseEnsHookResponse = ReadHook & { data?: string };

type ensSubdomain = 'ipfs' | 'test.ipfs'; //can add arweave etc. in the future

function removeProtocolScheme(content: string | undefined, protocol: ensSubdomain) {
  if (content && protocol.includes('ipfs')) return content.replace('ipfs://', '');
  return content;
}

type UseEnsContentProperties = {
  name: string;
  subdomain: ensSubdomain;
  chainId?: number;
};
export function useEnsContent({
  name,
  subdomain,
  chainId = TENDERLY_CHAIN_ID //TODO: remove or switch to 1 once we set up a mainnet ens address
}: UseEnsContentProperties): UseEnsHookResponse {
  const {
    data: resolver,
    error: resolverError,
    refetch: resolverRefetch
  } = useEnsResolver({ name: `${subdomain}.${name}`, chainId });

  const { error, data, isLoading } = useQuery({
    queryKey: [subdomain, name, chainId],
    queryFn: async () => {
      const val = await resolver;
      return removeProtocolScheme(val, subdomain);
    }
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: resolverError || (error as Error),
    mutate: resolverRefetch,
    dataSources: [
      {
        title: 'ENS',
        onChain: true,
        href: `https://app.ens.domains/name/${name}/`,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
      }
    ]
  };
}
