import { ZERO_ADDRESS } from '../constants';
import { useConnection, useChainId } from 'wagmi';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { TradeAllowanceHookResponse } from './trade';
import { gpv2VaultRelayerAddress } from './constants';

export function useTradeAllowance(
  tokenAddress?: `0x${string}`,
  address?: `0x${string}`
): TradeAllowanceHookResponse {
  const { address: connectedAddress } = useConnection();
  const acct = address || connectedAddress || ZERO_ADDRESS;
  const chainId = useChainId();

  const useAllowanceResponse = useTokenAllowance({
    chainId,
    contractAddress: tokenAddress,
    owner: acct,
    spender: gpv2VaultRelayerAddress[chainId as keyof typeof gpv2VaultRelayerAddress]
  });

  return {
    ...useAllowanceResponse,
    isLoading: useAllowanceResponse.isLoading,
    error: useAllowanceResponse.error,
    dataSources: [...useAllowanceResponse.dataSources]
  };
}
