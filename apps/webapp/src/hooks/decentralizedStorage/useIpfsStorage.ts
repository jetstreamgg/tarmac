// This hook is meant to be used to fetch a file from a decentralized storage. It returns the file as a text or a blob.
// It also returns the status of the file fetching process.
// The hook takes the following parameters:
// useDecentralizedStorage will need to use a IPFS client that gets configured through a provider.
/*
 Example of how the provider could be implemented:

 <MakerProvider clients={{
    ipfs: { host: 'ipfs.infura.io', port: 5001, protocol: 'https' }
 }}>
    {app}
 </MakerProvider>

 then the useDecentralizedStorage hook could access the provider client like this:
 const { ipfs } = useMakerHooksConfig();

 Possible IPFS Dependency: https://www.npmjs.com/package/ipfs-http-client
*/
import { useMakerHooks } from '../context/context';
import { ReadHook } from '../hooks';
import { TrustLevelEnum, TRUST_LEVELS } from '../constants';
import { useQuery } from '@tanstack/react-query';

type DecentralizedStorageHookResponse = ReadHook & {
  data?: string | Blob;
};

function fetchFile(gateway: string, hash: string) {
  const ipfsGateway = `${gateway}/${hash}`;

  return fetch(ipfsGateway).then(response => {
    return response.text();
  });
}

// - fileHash: the hash of the file to fetch
export function useIpfsStorage(fileHash: string): DecentralizedStorageHookResponse {
  const {
    ipfs: { gateway }
  } = useMakerHooks();

  //if fileHash is falsey, useQuery hook won't do anything since key is falsey
  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery<string | Blob>({
    enabled: !!fileHash,
    queryKey: [gateway, fileHash],
    queryFn: () => fetchFile(gateway, fileHash)
  });

  return {
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    data,
    dataSources: [
      {
        title: 'IPFS',
        href: `${gateway}/${fileHash}`,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
