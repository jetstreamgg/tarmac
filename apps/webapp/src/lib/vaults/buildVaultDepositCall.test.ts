import { describe, expect, it } from 'vitest';
import { Abi, decodeFunctionData, encodeFunctionData } from 'viem';
import { buildVaultDepositCall } from './buildVaultDepositCall';
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
  it('encodes the ERC-4626 deposit(assets, receiver) call', () => {
    const call = buildVaultDepositCall({ vaultAddress: VAULT_ADDRESS, amount: AMOUNT, receiver: RECEIVER });

    const decoded = decodeFunctionData({ abi: usdsRiskCapitalVaultAbi, data: encodeCall(call) });

    expect(call.to).toBe(VAULT_ADDRESS);
    expect(decoded.functionName).toBe('deposit');
    expect(decoded.args?.length).toBe(2);
    expect(decoded.args?.[0]).toBe(AMOUNT);
    expect((decoded.args?.[1] as string).toLowerCase()).toBe(RECEIVER);
  });
});
