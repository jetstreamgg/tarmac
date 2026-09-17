import { useChainId, useConnection } from 'wagmi';
import { math } from '@/utils';
import { BatchWriteHookParams } from '../hooks';
import { useSavingsAllowance } from './useSavingsAllowance';
import { sUsdsAddress, sUsdsImplementationAbi } from './useReadSavingsUsds';
import { getWriteContractCall } from '../shared/getWriteContractCall';
import { usdcAddress, usdsAddress, usdsPsmWrapperAbi, usdsPsmWrapperAddress } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

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
 * `useUsdcSupplyGate` in `modules/savings/hooks` is that gate, and `useSavingsLaunch`
 * — the only caller — folds it into the `enabled` it passes here, so nothing that
 * routes through the orchestrator can arm an ungated engine. Any caller reaching
 * for this hook directly must do the same.
 */
export function useBatchPsmSwapAndSavingsSupply({
  amount,
  ref = 0,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  /** USDC in, at the token's 6 decimals. */
  amount: bigint;
  ref?: number;
}): ApproveThenActHook {
  const { address } = useConnection();
  const chainId = useChainId();

  const usdc = usdcAddress[chainId as keyof typeof usdcAddress];
  const wrapper = usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress];
  const usds = usdsAddress[chainId as keyof typeof usdsAddress];
  const sUsds = sUsdsAddress[chainId as keyof typeof sUsdsAddress];
  // The USDS the wrapper hands back for `amount` USDC at a zero fee — what steps 3
  // and 4 spend.
  const usdsAmount = math.convertUSDCtoWad(amount);

  const { data: usdcAllowance, error: usdcAllowanceError } = useTokenAllowance({
    chainId,
    contractAddress: usdc,
    owner: address,
    spender: wrapper
  });
  const { data: usdsAllowance, error: usdsAllowanceError } = useSavingsAllowance();

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount > 0n && !!usdc && !!wrapper,
    legs: [
      {
        approve: {
          token: usdc,
          spender: wrapper,
          amount,
          allowance: usdcAllowance,
          allowanceError: usdcAllowanceError
        },
        calls: [
          getWriteContractCall({
            to: wrapper,
            abi: usdsPsmWrapperAbi,
            functionName: 'sellGem',
            args: [address!, amount]
          })
        ]
      },
      {
        approve: {
          token: usds,
          spender: sUsds,
          amount: usdsAmount,
          allowance: usdsAllowance,
          allowanceError: usdsAllowanceError
        },
        calls: [
          getWriteContractCall({
            to: sUsds,
            abi: sUsdsImplementationAbi,
            functionName: 'deposit',
            args: [usdsAmount, address!, ref]
          })
        ]
      }
    ]
  });
}
