import {
  BatchWriteHookParams,
  daiUsdsAbi,
  daiUsdsAddress,
  getWriteContractCall,
  mkrSkyAbi,
  mkrSkyAddress,
  Token,
  TOKENS,
  useTransactionFlow,
  useTokenAllowance
} from '@jetstreamgg/sky-hooks';
import { Call, erc20Abi } from 'viem';
import { useConnection, useChainId } from 'wagmi';

export function useBatchUpgraderManager({
  token,
  amount,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  ...params
}: BatchWriteHookParams & {
  token: Token;
  amount: bigint;
}) {
  const chainId = useChainId();
  const { address } = useConnection();
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

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);

  // Only create upgrade call if we have a valid token symbol
  if (token.symbol) {
    // Determine the function name based on token symbol and available functions
    let functionName: 'daiToUsds' | 'usdsToDai' | 'mkrToSky';
    if (token.symbol === TOKENS.dai.symbol) {
      functionName = 'daiToUsds';
    } else if (token.symbol === TOKENS.usds.symbol) {
      functionName = 'usdsToDai';
    } else if (token.symbol === TOKENS.mkr.symbol) {
      functionName = 'mkrToSky';
    } else if (token.symbol === TOKENS.sky.symbol) {
      // SKY to MKR conversion is not supported in the current contract
      throw new Error('SKY to MKR conversion is not supported');
    } else {
      throw new Error(`Unsupported token symbol: ${token.symbol}`);
    }

    const upgradeCall = getWriteContractCall({
      to: upgraderConfig.address,
      abi: upgraderConfig.abi,
      functionName,
      args: [address!, amount]
    });

    calls.push(upgradeCall);
  }

  const enabled = paramEnabled && !!address && amount !== 0n && !!token.symbol;

  return useTransactionFlow({
    calls,
    enabled,
    shouldUseBatch,
    ...params
  });
}
