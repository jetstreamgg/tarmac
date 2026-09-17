import { useChainId, useConnection } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdsAddress, usdsPsmWrapperAbi, usdsPsmWrapperAddress } from '../generated';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/** Mainnet USDS → USDC through the PSM wrapper: optional approve(USDS) → `buyGem`. */
export function useBatchUsdsPsmWrapperBuyGem({
  gemAmt,
  usdsAmountInWad,
  usr,
  chainIdOverride,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  gemAmt: bigint;
  usdsAmountInWad: bigint;
  usr?: `0x${string}`;
  chainIdOverride?: number;
}): ApproveThenActHook {
  const connectedChainId = useChainId();
  const { address } = useConnection();
  const chainId = chainIdOverride ?? connectedChainId;
  const wrapper = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const recipient = usr ?? address;

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: usds,
    owner: address,
    spender: wrapper
  });

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && gemAmt !== 0n && usdsAmountInWad !== 0n && !!recipient,
    legs: [
      {
        approve: { token: usds, spender: wrapper, amount: usdsAmountInWad, allowance, allowanceError },
        calls: [
          getWriteContractCall({
            to: wrapper,
            abi: usdsPsmWrapperAbi,
            functionName: 'buyGem',
            args: [recipient!, gemAmt]
          })
        ]
      }
    ]
  });
}
