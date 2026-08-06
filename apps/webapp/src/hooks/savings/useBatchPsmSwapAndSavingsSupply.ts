import { useChainId, useConnection } from 'wagmi';
import { Call, erc20Abi } from 'viem';
import { math } from '@/utils';
import { BatchWriteHook, BatchWriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdcAddress, usdsAddress } from '../generated';
import { usdsPsmWrapperAbi, usdsPsmWrapperAddress } from '../psm/usdsPsmWrapper';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { useTransactionFlow } from '../shared/useTransactionFlow';

/**
 * Mainnet USDC → Sky Savings, in one flow. The savings vault only takes USDS, so a
 * USDC supply is the DAI path's shape with the PSM standing in for the DAI upgrade:
 *
 *   1. approve USDC → the USDS PSM wrapper   (elided when the allowance covers it)
 *   2. `sellGem(user, gemAmt)`               — USDC → USDS, 1:1 while `tin` is 0
 *   3. approve USDS → sUSDS                  (elided when the allowance covers it)
 *   4. `deposit(usdsAmount, user, ref)`      — the same deposit every supply ends on
 *
 * Bundled into one EIP-5792 call when the wallet supports it, otherwise sent as up
 * to four sequential transactions — exactly like `useBatchUpgradeAndSavingsSupply`.
 *
 * `amount` is USDC (6-dec). The wrapper mints `amount * 1e12` USDS when `tin` is 0,
 * so the USDS approve + deposit both use that widened wad. There is no dust: 6 → 18
 * decimals is exact.
 *
 * PRECONDITION — this hook does NOT read the PSM's switches, so the caller must:
 * only enable it while the wrapper is live, the sell direction is not halted, and
 * `tin` is 0. A nonzero `tin` makes `sellGem` return LESS than the wad below, and
 * the deposit then fails against a swap that has already landed (atomic under
 * EIP-5792, but stranding USDS in the wallet on the sequential path).
 * `useUsdcSupplyGate` in `modules/savings/hooks` is that gate; `useSavingsLaunch`
 * is the only caller and routes through it. Any new caller must do the same.
 */
export function useBatchPsmSwapAndSavingsSupply({
  amount,
  onMutate = () => null,
  onSuccess = () => null,
  onError = () => null,
  onStart = () => null,
  enabled: paramEnabled = true,
  shouldUseBatch = true,
  ref = 0
}: BatchWriteHookParams & {
  /** USDC in, at the token's 6 decimals. */
  amount: bigint;
  ref?: number;
}): BatchWriteHook {
  const { address: connectedAddress, isConnected } = useConnection();
  const chainId = useChainId();

  const usdcToken = usdcAddress[chainId as keyof typeof usdcAddress];
  const wrapperAddress = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  // The USDS the wrapper hands back for `amount` USDC at a zero fee — what steps 3
  // and 4 spend.
  const usdsAmount = math.convertUSDCtoWad(amount);

  const { data: usdcSwapAllowance } = useTokenAllowance({
    chainId,
    contractAddress: usdcToken,
    owner: connectedAddress,
    spender: wrapperAddress
  });
  const { data: usdsSupplyAllowance, error: allowanceError } = useSavingsAllowance();

  const hasUsdcSwapAllowance = usdcSwapAllowance !== undefined && usdcSwapAllowance >= amount;
  const hasUsdsSupplyAllowance = usdsSupplyAllowance !== undefined && usdsSupplyAllowance >= usdsAmount;

  const calls: Call[] = [];

  const approveUsdcCall = getWriteContractCall({
    to: usdcToken,
    abi: erc20Abi,
    functionName: 'approve',
    args: [wrapperAddress, amount]
  });

  const sellGemCall = getWriteContractCall({
    to: wrapperAddress,
    abi: usdsPsmWrapperAbi,
    functionName: 'sellGem',
    args: [connectedAddress!, amount]
  });

  if (!hasUsdcSwapAllowance) calls.push(approveUsdcCall);
  calls.push(sellGemCall);

  const approveUsdsCall = getWriteContractCall({
    to: usdsAddress[chainId as keyof typeof usdsAddress],
    abi: erc20Abi,
    functionName: 'approve',
    args: [sUsdsAddress[chainId as keyof typeof sUsdsAddress], usdsAmount]
  });

  const supplyCall = getWriteContractCall({
    to: sUsdsAddress[chainId as keyof typeof sUsdsAddress],
    abi: sUsdsImplementationAbi,
    functionName: 'deposit',
    args: [usdsAmount, connectedAddress!, ref]
  });

  if (!hasUsdsSupplyAllowance) calls.push(approveUsdsCall);
  calls.push(supplyCall);

  const enabled =
    paramEnabled &&
    isConnected &&
    !!connectedAddress &&
    !!usdcToken &&
    !!wrapperAddress &&
    amount > 0n &&
    usdcSwapAllowance !== undefined &&
    usdsSupplyAllowance !== undefined;

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
