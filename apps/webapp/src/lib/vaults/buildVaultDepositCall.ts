import { Abi, Call } from 'viem';
import { VaultProvider } from '@/hooks/vaults/types';
import { sparkVaultAbi } from '@/hooks/abis/sparkVaultAbi';
import { usdsRiskCapitalVaultAbi } from '@/hooks/generated';
import { getWriteContractCall } from '@/hooks/shared/getWriteContractCall';

/**
 * Build the ERC-4626 deposit call for a vault, attaching the on-chain referral
 * code only for Spark vaults (and only when a non-zero code is configured).
 *
 * Spark's vault exposes an overloaded `deposit(assets, receiver, uint16 referral)`
 * that emits a `Referral` event for attribution; the Morpho ERC-4626 vault has only
 * the 2-arg form. Gating mirrors `useBatchStUsdsDeposit`'s `referral > 0` semantics,
 * and the Morpho path stays byte-for-byte identical to the plain 2-arg deposit.
 */
export function buildVaultDepositCall({
  provider,
  vaultAddress,
  amount,
  receiver,
  referral
}: {
  provider: VaultProvider;
  vaultAddress: `0x${string}`;
  amount: bigint;
  receiver: `0x${string}`;
  referral: number;
}): Call {
  const sendReferral = provider === 'sky' && referral > 0;

  if (sendReferral) {
    // Only sparkVaultAbi carries the 3-arg overload; the Morpho abi has just the 2-arg form.
    return getWriteContractCall({
      to: vaultAddress,
      abi: sparkVaultAbi as Abi,
      functionName: 'deposit',
      args: [amount, receiver, referral]
    });
  }

  return getWriteContractCall({
    to: vaultAddress,
    abi: usdsRiskCapitalVaultAbi,
    functionName: 'deposit',
    args: [amount, receiver]
  });
}
