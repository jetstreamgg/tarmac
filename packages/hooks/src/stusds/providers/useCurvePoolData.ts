import { useMemo } from 'react';
import { useChainId, useReadContracts } from 'wagmi';
import { curveStUsdsUsdsPoolAddress, curveStUsdsUsdsPoolAbi, usdsAddress } from '../../generated';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '../../constants';
import { CURVE_POOL_TOKEN_INDICES } from './constants';

/**
 * Data returned from the Curve pool.
 */
export type CurvePoolData = {
  /** Reserve of USDS in the pool */
  usdsReserve: bigint;
  /** Reserve of stUSDS in the pool */
  stUsdsReserve: bigint;
  /** Current swap fee (scaled, typically 1e10 = 100%) */
  fee: bigint;
  /** Admin fee percentage */
  adminFee: bigint;
  /** Token address at index 0 */
  coin0: `0x${string}`;
  /** Token address at index 1 */
  coin1: `0x${string}`;
  /** Verified token indices */
  tokenIndices: {
    usds: number;
    stUsds: number;
  };
};

/**
 * Return type for useCurvePoolData hook.
 */
export type CurvePoolDataHookResult = {
  data: CurvePoolData | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Hook to read Curve USDS/stUSDS pool state.
 * Fetches reserves, fees, and token configuration.
 */
export function useCurvePoolData(): CurvePoolDataHookResult {
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

  const poolAddress = curveStUsdsUsdsPoolAddress[chainId as keyof typeof curveStUsdsUsdsPoolAddress];
  const expectedUsdsAddress = usdsAddress[chainId as keyof typeof usdsAddress];

  const poolContract = {
    address: poolAddress,
    abi: curveStUsdsUsdsPoolAbi,
    chainId
  } as const;

  // Batch all reads into a single multicall
  const {
    data: readData,
    isLoading,
    error,
    refetch
  } = useReadContracts({
    allowFailure: true,
    contracts: [
      {
        ...poolContract,
        functionName: 'balances',
        args: [BigInt(0)]
      },
      {
        ...poolContract,
        functionName: 'balances',
        args: [BigInt(1)]
      },
      {
        ...poolContract,
        functionName: 'fee'
      },
      {
        ...poolContract,
        functionName: 'admin_fee'
      },
      {
        ...poolContract,
        functionName: 'coins',
        args: [BigInt(0)]
      },
      {
        ...poolContract,
        functionName: 'coins',
        args: [BigInt(1)]
      }
    ]
  });

  const data: CurvePoolData | undefined = useMemo(() => {
    if (!readData) return undefined;

    // With allowFailure: true, results are { result, status } objects
    // Check if all calls succeeded
    const allSucceeded = readData.every(r => r.status === 'success');
    if (!allSucceeded) {
      return undefined;
    }

    const balance0 = readData[0].result as bigint;
    const balance1 = readData[1].result as bigint;
    const fee = readData[2].result as bigint;
    const adminFee = readData[3].result as bigint;
    const coin0 = readData[4].result as `0x${string}`;
    const coin1 = readData[5].result as `0x${string}`;

    // Determine token indices by matching addresses
    // Start with default values, then verify against actual pool configuration
    let usdsIndex: number = CURVE_POOL_TOKEN_INDICES.USDS;
    let stUsdsIndex: number = CURVE_POOL_TOKEN_INDICES.STUSDS;

    // Verify and correct indices based on actual pool configuration
    if (coin0.toLowerCase() === expectedUsdsAddress?.toLowerCase()) {
      usdsIndex = 0;
      stUsdsIndex = 1;
    } else if (coin1.toLowerCase() === expectedUsdsAddress?.toLowerCase()) {
      usdsIndex = 1;
      stUsdsIndex = 0;
    }

    const usdsReserve = usdsIndex === 0 ? balance0 : balance1;
    const stUsdsReserve = stUsdsIndex === 0 ? balance0 : balance1;

    return {
      usdsReserve,
      stUsdsReserve,
      fee,
      adminFee,
      coin0,
      coin1,
      tokenIndices: {
        usds: usdsIndex,
        stUsds: stUsdsIndex
      }
    };
  }, [readData, expectedUsdsAddress]);

  return {
    data,
    isLoading,
    error: error as Error | null,
    refetch
  };
}
