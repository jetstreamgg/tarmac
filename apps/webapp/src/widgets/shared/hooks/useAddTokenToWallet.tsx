import { useConnectorClient } from 'wagmi';
import { watchAsset } from 'viem/actions';
import { WatchAssetParams } from 'viem';
import { useMutation } from '@tanstack/react-query';

export function useAddTokenToWallet() {
  const { data: walletClient } = useConnectorClient();
  const mutation = useMutation({
    mutationFn: (asset: WatchAssetParams) => {
      if (walletClient && asset) {
        return watchAsset(walletClient, asset);
      }
      return Promise.reject(new Error('No wallet client'));
    }
  });

  return mutation;
}
