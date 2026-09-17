import { useConnection, useChainId } from 'wagmi';
import { BatchWriteHookParams } from '../hooks';
import { usdtAbi, usdtAddress } from '../generated';
import { useTokenAllowance } from '../tokens/useTokenAllowance';
import { buildVaultDepositCall } from '@/lib/vaults/buildVaultDepositCall';
import { ApproveThenActHook, useApproveThenAct } from '../shared/useApproveThenAct';

/**
 * Deposit into an ERC-4626 vault: optional approve → `deposit(assets, receiver)`,
 * with the USDT allowance reset ahead of the approve when a nonzero allowance
 * exists (USDT refuses a nonzero → nonzero approve).
 *
 * @param amount - Underlying assets to deposit, in the asset's decimals (e.g. 6 for USDC)
 * @param vaultAddress - The vault to deposit into
 * @param assetAddress - The underlying asset token (e.g. USDC) the vault pulls
 */
export function useBatchVaultDeposit({
  amount,
  vaultAddress,
  assetAddress,
  enabled = true,
  ...flow
}: BatchWriteHookParams & {
  amount: bigint;
  vaultAddress: `0x${string}`;
  assetAddress: `0x${string}`;
}): ApproveThenActHook {
  const { address } = useConnection();
  const chainId = useChainId();

  const isUsdt = assetAddress === usdtAddress[chainId as keyof typeof usdtAddress];

  const { data: allowance, error: allowanceError } = useTokenAllowance({
    chainId,
    contractAddress: assetAddress,
    owner: address,
    spender: vaultAddress
  });

  return useApproveThenAct({
    ...flow,
    chainId,
    enabled: enabled && amount !== 0n && !!vaultAddress && !!assetAddress,
    legs: [
      {
        approve: {
          token: assetAddress,
          spender: vaultAddress,
          amount,
          allowance,
          allowanceError,
          resetFirst: isUsdt,
          abi: isUsdt ? usdtAbi : undefined
        },
        // receiver is the connected address — they receive the vault shares.
        calls: [buildVaultDepositCall({ vaultAddress, amount, receiver: address! })]
      }
    ]
  });
}
