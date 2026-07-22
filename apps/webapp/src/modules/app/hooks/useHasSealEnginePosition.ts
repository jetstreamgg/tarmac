import { useQuery } from '@tanstack/react-query';
import { request, gql } from 'graphql-request';
import { useConnection, useChainId } from 'wagmi';
import { getIndexerUrl } from '@/hooks/helpers/getIndexerUrl';
import { isMainnetId, chainId as chainIdMap } from '@/utils';

/**
 * Detection-only hook for the deprecated Seal Engine. The Seal Engine UI was removed from the app,
 * but a small number of wallets still have MKR locked in it. This reads the Sky Ecosystem indexer
 * for any MKR the connected wallet still has sealed, so we can surface a withdrawal notification that
 * links to the static /seal-engine instructions page.
 *
 * Seal Engine only ever existed on mainnet, so we always query the mainnet subgraph.
 */
async function fetchSealedMkr(urlIndexer: string, chainId: number, address: string): Promise<bigint> {
  const query = gql`
    {
      sealUrns: SealUrn(where: { owner: { _eq: "${address.toLowerCase()}" }, chainId: { _eq: ${chainId} } }) {
        mkrLocked
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as { sealUrns: { mkrLocked: string }[] };

  if (!response.sealUrns || response.sealUrns.length === 0) {
    return 0n;
  }

  return response.sealUrns.reduce((acum, urn) => acum + BigInt(urn.mkrLocked), 0n);
}

export const useHasSealEnginePosition = () => {
  const { address, isConnected } = useConnection();
  const currentChainId = useChainId();
  // Seal Engine is mainnet-only; resolve to mainnet regardless of the connected chain.
  const sealChainId = isMainnetId(currentChainId) ? currentChainId : chainIdMap.mainnet;
  const urlIndexer = getIndexerUrl(sealChainId) || '';

  const { data: sealedMkr, isLoading } = useQuery({
    enabled: Boolean(urlIndexer && address && isConnected),
    queryKey: ['seal-engine-position', urlIndexer, address, sealChainId],
    queryFn: () => fetchSealedMkr(urlIndexer, sealChainId, address!)
  });

  // The user said to simply notify on any amount deposited, so a non-zero locked balance qualifies.
  const hasPosition = !!(isConnected && address && sealedMkr && sealedMkr > 0n);

  return {
    hasPosition,
    sealedMkr,
    isLoading,
    isReady: !isLoading
  };
};
