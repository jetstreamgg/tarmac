import { useReadContract } from 'wagmi';
import { chainalysisOracleAbi, chainalysisOracleAddress, DEFAULT_ORACLE_CHAIN_ID } from './chainalysisOracle';

type AuthResponse = {
  addressAllowed: boolean;
};

type UseChainalysisCheckProps = {
  address?: string;
  chainId?: number;
  enabled?: boolean;
};

/**
 * Hook to check if an address is sanctioned using the Chainalysis Oracle contract.
 * Falls back to Ethereum mainnet oracle if the chain is not supported.
 *
 * @returns normalized response where `addressAllowed: true` means the address is NOT sanctioned
 */
export const useChainalysisCheck = ({
  address,
  chainId,
  enabled = true
}: UseChainalysisCheckProps): {
  data: AuthResponse | undefined;
  error: Error | undefined;
  isLoading: boolean;
} => {
  // Use the chain's oracle if available, otherwise fall back to mainnet
  const effectiveChainId = chainId && chainalysisOracleAddress[chainId] ? chainId : DEFAULT_ORACLE_CHAIN_ID;
  const oracleAddress = chainalysisOracleAddress[effectiveChainId];

  const { data, error, isLoading } = useReadContract({
    address: oracleAddress,
    abi: chainalysisOracleAbi,
    functionName: 'isSanctioned',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: effectiveChainId,
    query: {
      enabled: enabled && !!address
    }
  });

  // Normalize: isSanctioned = true means address is NOT allowed
  // So addressAllowed = !isSanctioned
  const normalizedData = data !== undefined ? { addressAllowed: !data } : undefined;

  return {
    data: normalizedData,
    error: error ?? undefined,
    isLoading
  };
};
