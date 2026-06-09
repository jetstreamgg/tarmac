import { describe, expect, it } from 'vitest';
import { Abi, decodeFunctionData, encodeFunctionData } from 'viem';
import { buildVaultDepositCall } from './buildVaultDepositCall';
import { sparkVaultAbi } from '@/hooks/abis/sparkVaultAbi';
import { usdsRiskCapitalVaultAbi } from '@/hooks/generated';

const VAULT_ADDRESS = '0x74cb54e082411cfCAEADb00a0765625B10410DAa' as const;
const RECEIVER = '0x1111111111111111111111111111111111111111' as const;
const AMOUNT = 1_000_000n;

// The Call returned by getWriteContractCall carries abi/functionName/args; encode
// it to the bytes that would actually be broadcast, then decode to assert the
// on-chain deposit semantics (function + args), not the builder's internal shape.
function encodeCall(call: ReturnType<typeof buildVaultDepositCall>) {
  const { abi, functionName, args } = call as unknown as {
    abi: Abi;
    functionName: string;
    args: readonly unknown[];
  };
  return encodeFunctionData({ abi, functionName, args });
}

describe('buildVaultDepositCall', () => {
  it('encodes the 3-arg deposit(assets, receiver, referral) for a Spark vault with a referral code', () => {
    const call = buildVaultDepositCall({
      provider: 'sky',
      vaultAddress: VAULT_ADDRESS,
      amount: AMOUNT,
      receiver: RECEIVER,
      referral: 555
    });

    const decoded = decodeFunctionData({ abi: sparkVaultAbi as Abi, data: encodeCall(call) });

    expect(decoded.functionName).toBe('deposit');
    expect(decoded.args?.length).toBe(3);
    expect(decoded.args?.[0]).toBe(AMOUNT);
    expect((decoded.args?.[1] as string).toLowerCase()).toBe(RECEIVER);
    expect(decoded.args?.[2]).toBe(555);
  });

  it('keeps the 2-arg deposit(assets, receiver) for a Morpho vault even when a referral code is present', () => {
    const call = buildVaultDepositCall({
      provider: 'morpho',
      vaultAddress: VAULT_ADDRESS,
      amount: AMOUNT,
      receiver: RECEIVER,
      referral: 555
    });

    const decoded = decodeFunctionData({ abi: usdsRiskCapitalVaultAbi, data: encodeCall(call) });

    expect(decoded.functionName).toBe('deposit');
    expect(decoded.args?.length).toBe(2);
    expect(decoded.args?.[0]).toBe(AMOUNT);
    expect((decoded.args?.[1] as string).toLowerCase()).toBe(RECEIVER);
  });

  it('falls back to the 2-arg deposit for a Spark vault when no referral code is configured (0)', () => {
    const call = buildVaultDepositCall({
      provider: 'sky',
      vaultAddress: VAULT_ADDRESS,
      amount: AMOUNT,
      receiver: RECEIVER,
      referral: 0
    });

    const decoded = decodeFunctionData({ abi: usdsRiskCapitalVaultAbi, data: encodeCall(call) });

    expect(decoded.functionName).toBe('deposit');
    expect(decoded.args?.length).toBe(2);
  });
});
