/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, parseEther, type Call, type PublicClient } from 'viem';
import { ARBITRUM_DEPOSIT, L1_USDS, OP_STACK_DEPOSIT } from '../adapters/nativeDeposit/contracts';
import { OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT } from '../adapters/nativeWithdrawal/contracts';
import { useNativeWithdrawalLegs } from './useNativeWithdrawalLegs';

const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const RECIPIENT = getAddress('0x2546BcD3c84621e976D8185a91A922aE77ECEc30');
const AMOUNT = parseEther('25');

const mocks = vi.hoisted(() => ({
  gate: { isOpen: 1n, maxWithdraws: 10n ** 30n } as { isOpen: bigint | Error; maxWithdraws: bigint },
  allowance: undefined as bigint | undefined,
  allowanceError: null as Error | null,
  allowanceArgs: [] as { chainId: number; contractAddress?: string; owner?: string; spender?: string }[],
  legsArgs: [] as {
    calls: Call[];
    chainId?: number;
    sendFunctionName: string;
    preflight: (client: PublicClient, calls: readonly Call[]) => Promise<Error | undefined>;
  }[]
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  usePublicClient: () => ({})
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (args: (typeof mocks.allowanceArgs)[number]) => {
    mocks.allowanceArgs.push(args);
    return {
      data: args.contractAddress ? mocks.allowance : undefined,
      error: mocks.allowanceError,
      mutate: vi.fn()
    };
  }
}));
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (args: (typeof mocks.legsArgs)[number]) => {
    mocks.legsArgs.push(args);
    return { isBatch: false, ready: args.calls.length > 0, busy: false, legMined: false, error: null };
  }
}));

const gateClient = {
  readContract: async ({ functionName }: { functionName: string }) => {
    if (functionName === 'isOpen') {
      if (mocks.gate.isOpen instanceof Error) throw mocks.gate.isOpen;
      return mocks.gate.isOpen;
    }
    return mocks.gate.maxWithdraws;
  }
} as unknown as PublicClient;

const callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };

type LegsProps = Partial<Parameters<typeof useNativeWithdrawalLegs>[0]>;
const renderLegs = (props: LegsProps = {}) =>
  renderHook(() =>
    useNativeWithdrawalLegs({
      enabled: true,
      from: 'base',
      chainId: 8453,
      account: SENDER,
      recipient: undefined,
      amount: AMOUNT,
      getCallbacks: () => callbacks,
      ...props
    })
  ).result.current;

describe('useNativeWithdrawalLegs', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      gate: { isOpen: 1n, maxWithdraws: 10n ** 30n },
      allowance: 0n,
      allowanceError: null,
      allowanceArgs: [],
      legsArgs: []
    });
  });

  it('approves the L2 bridge on the L2 USDS and withdraws to the sender on Ethereum', () => {
    const legs = renderLegs();
    expect(mocks.allowanceArgs.at(-1)).toMatchObject({
      chainId: 8453,
      contractAddress: OP_STACK_DEPOSIT.base.l2Usds,
      owner: SENDER,
      spender: OP_STACK_DEPOSIT.base.l2TokenBridge
    });
    expect(legs.calls.map(call => call.functionName)).toEqual(['approve', 'bridgeERC20To']);
    expect(legs.calls[1].args).toEqual([
      OP_STACK_DEPOSIT.base.l2Usds,
      L1_USDS,
      SENDER,
      AMOUNT,
      OP_STACK_WITHDRAWAL_MIN_GAS_LIMIT,
      '0x'
    ]);
    expect(legs.needsApprove).toBe(true);
    expect(mocks.legsArgs.at(-1)).toMatchObject({ chainId: 8453, sendFunctionName: 'bridgeERC20To' });
  });

  it('withdraws from Arbitrum through the gateway, to an entered recipient', () => {
    mocks.allowance = AMOUNT;
    const legs = renderLegs({ from: 'arbitrum', chainId: 42161, recipient: RECIPIENT.toLowerCase() });
    expect(mocks.allowanceArgs.at(-1)).toMatchObject({
      contractAddress: ARBITRUM_DEPOSIT.l2Usds,
      spender: ARBITRUM_DEPOSIT.l2Gateway
    });
    expect(legs.calls.map(call => call.functionName)).toEqual(['outboundTransfer']);
    expect(legs.calls[0].args).toEqual([L1_USDS, RECIPIENT, AMOUNT, '0x']);
    expect(mocks.legsArgs.at(-1)?.sendFunctionName).toBe('outboundTransfer');
  });

  it('builds no calls while the allowance is unknown, and surfaces its error', () => {
    mocks.allowance = undefined;
    mocks.allowanceError = new Error('allowance read failed');
    const legs = renderLegs();
    expect(legs.calls).toEqual([]);
    expect(legs.error).toBe(mocks.allowanceError);
  });

  it('builds no calls when disabled, for a zero amount or for a blocked recipient', () => {
    expect(renderLegs({ enabled: false }).calls).toEqual([]);
    expect(renderLegs({ amount: 0n }).calls).toEqual([]);
    expect(renderLegs({ recipient: OP_STACK_DEPOSIT.base.l2TokenBridge }).calls).toEqual([]);
  });

  it('re-reads the gate at Confirm: a closed bridge or an amount over the limit stops the send', async () => {
    renderLegs();
    const { preflight, calls } = mocks.legsArgs.at(-1)!;
    expect(await preflight(gateClient, calls)).toBeUndefined();
    mocks.gate.isOpen = 0n;
    expect(await act(() => preflight(gateClient, calls))).toBeInstanceOf(Error);
    mocks.gate = { isOpen: 1n, maxWithdraws: AMOUNT - 1n };
    expect(await preflight(gateClient, calls)).toBeInstanceOf(Error);
    mocks.gate = { isOpen: new Error('rpc down'), maxWithdraws: AMOUNT };
    await expect(preflight(gateClient, calls)).rejects.toThrow('rpc down');
  });
});
