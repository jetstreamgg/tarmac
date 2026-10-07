import { Call } from 'viem';
import { usdsRiskCapitalVaultAbi } from '@/hooks/generated';
import { getWriteContractCall } from '@/hooks/shared/getWriteContractCall';

/** Build the ERC-4626 `deposit(assets, receiver)` call for a vault. */
export function buildVaultDepositCall({
  vaultAddress,
  amount,
  receiver
}: {
  vaultAddress: `0x${string}`;
  amount: bigint;
  receiver: `0x${string}`;
}): Call {
  return getWriteContractCall({
    to: vaultAddress,
    abi: usdsRiskCapitalVaultAbi,
    functionName: 'deposit',
    args: [amount, receiver]
  });
}
