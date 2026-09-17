import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { psm3L2Abi, psm3L2Address } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/** L2 PSM3: optional approve(assetIn → psm) → `swapExactIn`. */
export function useBatchPsmSwapExactIn({
  assetIn,
  assetOut,
  amountIn,
  minAmountOut,
  referralCode = 0n,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  assetIn: `0x${string}`;
  assetOut: `0x${string}`;
  amountIn: bigint;
  minAmountOut: bigint;
  referralCode?: bigint;
}): ApproveThenActHook {
  const chainId = useChainId();
  const { address } = useConnection();
  const psm = psm3L2Address[chainId as keyof typeof psm3L2Address];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetIn,
    owner: address,
    spender: psm
  });

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amountIn !== 0n,
    legs: [
      {
        approve: { token: assetIn, spender: psm, amount: amountIn, allowance, allowanceError },
        calls: [
          getWriteContractCall({
            to: psm,
            abi: psm3L2Abi,
            functionName: 'swapExactIn',
            args: [assetIn, assetOut, amountIn, minAmountOut, address!, referralCode]
          })
        ]
      }
    ]
  });
}
