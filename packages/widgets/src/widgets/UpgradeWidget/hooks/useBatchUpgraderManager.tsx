import {
  BatchWriteHookParams,
  daiUsdsAbi,
  daiUsdsAddress,
  getWriteContractCall,
  mkrSkyAbi,
  mkrSkyAddress,
  Token,
  TOKENS,
  useSendBatchTransactionFlow,
  useTokenAllowance
} from '@jetstreamgg/sky-hooks';
import { Call, erc20Abi } from 'viem';
import { useAccount, useChainId } from 'wagmi';

export function useBatchUpgraderManager({
  token,
  amount,
  enabled: paramEnabled = true,
  ...params
}: BatchWriteHookParams & {
  token: Token;
  amount: bigint;
}) {
  const chainId = useChainId();
  const { address } = useAccount();
  const upgraderConfig = [TOKENS.dai.symbol, TOKENS.usds.symbol].includes(token.symbol)
    ? { address: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress], abi: daiUsdsAbi }
    : { address: mkrSkyAddress[chainId as keyof typeof mkrSkyAddress], abi: mkrSkyAbi };

  // Get the allowance of the input token to be used by the upgrader contract
  const { data: allowance } = useTokenAllowance({
    chainId,
    contractAddress: token.address[chainId],
    owner: address,
    spender: upgraderConfig.address
  });

  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Calls for the batch transaction
  const approveCall = getWriteContractCall({
    to: token.address[chainId],
    abi: erc20Abi,
    functionName: 'approve',
    args: [upgraderConfig.address, amount]
  });

  const upgradeCall = getWriteContractCall({
    to: upgraderConfig.address,
    abi: upgraderConfig.abi,
    functionName:
      token.symbol === TOKENS.dai.symbol
        ? 'daiToUsds'
        : token.symbol === TOKENS.usds.symbol
          ? 'usdsToDai'
          : token.symbol === TOKENS.mkr.symbol
            ? 'mkrToSky'
            : 'skyToMkr',
    args: [address!, amount]
  });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(upgradeCall);

  const enabled = paramEnabled && !!address && amount !== 0n;

  return useSendBatchTransactionFlow({
    calls,
    enabled,
    ...params
  });
}
