import { beforeEach, describe, expect, it } from 'vitest';
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  decodeFunctionData,
  encodeErrorResult,
  encodeFunctionData,
  isAddressEqual,
  type Address,
  type Client
} from 'viem';
import type { ChainReader } from '../types';
import { optimismPortalAbi } from './contracts';
import { opStackWithdrawalMessage } from './opStack';
import { opStackWithdrawalActionCall } from './opStackActions';
import { BASE_WITHDRAWAL_LOGS, BASE_WITHDRAWAL_TX } from './withdrawalFixtures';

const MESSAGE = opStackWithdrawalMessage(BASE_WITHDRAWAL_LOGS, 'base')!;
const PROVER: Address = '0x00000000000000000000000000000000000b0b00';
const state = { check: undefined as string | undefined, checked: [] as string[] };

beforeEach(() => Object.assign(state, { check: undefined, checked: [] }));

const revert = (errorName: string) =>
  new ContractFunctionExecutionError(
    new ContractFunctionRevertedError({
      abi: optimismPortalAbi,
      data: encodeErrorResult({ abi: optimismPortalAbi, errorName: errorName as never }),
      functionName: 'checkWithdrawal'
    }),
    { abi: optimismPortalAbi, functionName: 'checkWithdrawal', args: [], contractAddress: PROVER }
  );

const l1 = {
  readContract: async ({ functionName, args }: { functionName: string; args?: readonly unknown[] }) => {
    switch (functionName) {
      case 'checkWithdrawal':
        state.checked.push(args![1] as string);
        if (state.check) throw revert(state.check);
        return undefined;
      case 'proofMaturityDelaySeconds':
      case 'disputeGameFinalityDelaySeconds':
        return 1n;
      case 'respectedGameType':
        return 621;
      case 'paused':
        return false;
      default:
        return '0x00000000000000000000000000000000000fac70';
    }
  }
} as unknown as ChainReader;

const l2 = {
  getTransactionReceipt: async () => ({ status: 'success', logs: BASE_WITHDRAWAL_LOGS })
} as unknown as ChainReader & Client;

const bridge = (routeData?: Record<string, string>, amount = MESSAGE.amount) => ({
  txHash: BASE_WITHDRAWAL_TX.hash,
  amount,
  recipient: MESSAGE.to,
  account: MESSAGE.from.toLowerCase(),
  routeData
});

const finalize = (routeData?: Record<string, string>, amount?: bigint) =>
  opStackWithdrawalActionCall({
    action: 'finalize',
    l1,
    l2,
    network: 'base',
    bridge: bridge(routeData, amount)
  });

describe('opStackWithdrawalActionCall: finalize', () => {
  it("finalizes the recorded withdrawal with the tracker's prover, once checkWithdrawal passes with its proof", async () => {
    const call = await finalize({ prover: PROVER });
    const { functionName, args } = decodeFunctionData({
      abi: optimismPortalAbi,
      data: encodeFunctionData(call)
    });
    expect(functionName).toBe('finalizeWithdrawalTransactionExternalProof');
    expect(isAddressEqual(args![1] as Address, PROVER)).toBe(true);
    expect(state.checked.map(prover => isAddressEqual(prover as Address, PROVER))).toEqual([true]);
    expect(args![0]).toMatchObject({ nonce: MESSAGE.withdrawal.nonce, data: MESSAGE.withdrawal.data });
  });

  it('builds no finalize before the proof is old enough, or without a known prover', async () => {
    state.check = 'OptimismPortal_ProofNotOldEnough';
    await expect(finalize({ prover: PROVER })).rejects.toThrow();
    state.check = undefined;
    await expect(finalize({})).rejects.toThrow();
    await expect(finalize({ prover: 'nope' })).rejects.toThrow();
  });

  it("builds no finalize for a receipt whose withdrawal isn't the recorded one", async () => {
    await expect(finalize({ prover: PROVER }, MESSAGE.amount + 1n)).rejects.toThrow();
  });
});
