import { useChainId, useConnection } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdcAddress, usdsPsmWrapperAbi, usdsPsmWrapperAddress } from '../generated';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/** Mainnet USDC → USDS through the PSM wrapper: optional approve(USDC) → `sellGem`. */
export function useBatchUsdsPsmWrapperSellGem({
  gemAmt,
  usr,
  chainIdOverride,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  gemAmt: bigint;
  usr?: `0x${string}`;
  chainIdOverride?: number;
}): ApproveThenActHook {
  const connectedChainId = useChainId();
  const { address } = useConnection();
  const chainId = chainIdOverride ?? connectedChainId;
  const wrapper = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  const usdc = usdcAddress[chainId as keyof typeof usdcAddress];
  const recipient = usr ?? address;

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: usdc,
    owner: address,
    spender: wrapper
  });

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && gemAmt !== 0n && !!recipient,
    legs: [
      {
        approve: { token: usdc, spender: wrapper, amount: gemAmt, allowance, allowanceError },
        calls: [
          getWriteContractCall({
            to: wrapper,
            abi: usdsPsmWrapperAbi,
            functionName: 'sellGem',
            args: [recipient!, gemAmt]
          })
        ]
      }
    ]
  });
}
