import { useConnection, useChainId } from 'wagmi';
import { Call, erc20Abi } from 'viem';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import {
  daiUsdsAbi,
  daiUsdsAddress,
  mcdDaiAddress,
  mkrAddress,
  mkrSkyAbi,
  mkrSkyAddress
} from '../generated';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { useTransactionFlow } from '../shared/useTransactionFlow';
import { useTokenAllowance } from '../tokens/useTokenAllowance';

/** The two upgradeable source tokens; each has a fixed upgrader + target. */
export type UpgradeSourceToken = 'DAI' | 'MKR';

/**
 * Batch/sequential engine for the standalone upgrade flow (DAI→USDS via
 * `daiToUsds`, MKR→SKY via `mkrToSky`) — the upgrade analogue of
 * `useBatchSavingsSupply`: optional approve → upgrade through
 * `useTransactionFlow`, so the pair is one EIP-5792 bundle when
 * `shouldUseBatch` (and the wallet) allow it, and two sequential signatures
 * otherwise. The single-call bare hooks (`useDaiToUsds` / `useMkrToSky`)
 * remain for consumers that orchestrate the approve themselves.
 */
export function useBatchUpgrade({
  token,
  amount,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: paramEnabled = true,
  shouldUseBatch = true
}: BatchWriteHookParams & {
  token: UpgradeSourceToken;
  amount: bigint;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  const isDai = token === 'DAI';
  const sourceAddress = isDai
    ? mcdDaiAddress[chainId as keyof typeof mcdDaiAddress]
    : mkrAddress[chainId as keyof typeof mkrAddress];
  const upgraderAddress = isDai
    ? daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
    : mkrSkyAddress[chainId as keyof typeof mkrSkyAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: sourceAddress,
    owner: connectedAddress,
    spender: upgraderAddress
  });
  const hasAllowance = allowance !== undefined && allowance >= amount;

  // Calls for the batch transaction
  const approveCall = getWriteContractCall({
    to: sourceAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [upgraderAddress, amount]
  });

  const upgradeCall = isDai
    ? getWriteContractCall({
        to: upgraderAddress,
        abi: daiUsdsAbi,
        functionName: 'daiToUsds',
        args: [connectedAddress!, amount]
      })
    : getWriteContractCall({
        to: upgraderAddress,
        abi: mkrSkyAbi,
        functionName: 'mkrToSky',
        args: [connectedAddress!, amount]
      });

  const calls: Call[] = [];
  if (!hasAllowance) calls.push(approveCall);
  calls.push(upgradeCall);

  const enabled =
    isConnected && amount !== 0n && allowance !== undefined && paramEnabled && !!connectedAddress;

  const transactionFlowResults = useTransactionFlow({
    calls,
    chainId,
    enabled,
    shouldUseBatch,
    onMutate,
    onSuccess,
    onError,
    onStart
  });

  return {
    ...transactionFlowResults,
    error: transactionFlowResults.error || allowanceError
  };
}
