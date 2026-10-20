/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { getAddress, type Call } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { L1_USDC, USDS_PSM_WRAPPER } from '../adapters/cctp/contracts';
import { useCctpConvertLegs } from './useCctpConvertLegs';

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const AMOUNT = 250n * 10n ** 6n;

const mocks = vi.hoisted(() => ({
  allowance: undefined as undefined | Record<string, unknown>,
  usdc: 0n as bigint | undefined,
  allowanceError: null as Error | null,
  legs: undefined as undefined | Record<string, unknown>,
  refusal: vi.fn()
}));

vi.mock('wagmi', () => ({ usePublicClient: () => ({ chain: 'ethereum' }) }));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (params: Record<string, unknown>) => {
    mocks.allowance = params;
    return {
      data: params.contractAddress ? mocks.usdc : undefined,
      error: mocks.allowanceError,
      mutate: vi.fn()
    };
  }
}));
vi.mock('../adapters/cctp/gate', () => ({ cctpConvertRefusal: mocks.refusal }));
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (params: Record<string, unknown>) => {
    mocks.legs = params;
    return { isBatch: false, ready: true, error: null, execute: vi.fn(), reset: vi.fn(), stop: vi.fn() };
  }
}));

const getCallbacks = () => ({}) as TxCallbacks;
const render = (overrides: Partial<Parameters<typeof useCctpConvertLegs>[0]> = {}) =>
  renderHook(() =>
    useCctpConvertLegs({
      enabled: true,
      amount: AMOUNT,
      chainId: 1,
      account: ACCOUNT,
      getCallbacks,
      ...overrides
    })
  ).result.current;
const calls = () => mocks.legs!.calls as (Call & { functionName: string; args: unknown[] })[];

describe('useCctpConvertLegs', () => {
  beforeEach(() => {
    mocks.allowance = undefined;
    mocks.usdc = 0n;
    mocks.allowanceError = null;
    mocks.legs = undefined;
    mocks.refusal.mockReset();
  });

  it('approves when short, then sells the amount for USDS to the same account, the sale recorded as sent', () => {
    expect(render({ batch: true }).ready).toBe(true);
    expect(mocks.legs).toMatchObject({ chainId: 1, sendFunctionName: 'sellGem', batch: true });
    expect(calls().map(call => call.functionName)).toEqual(['approve', 'sellGem']);
    expect(calls()[1]).toMatchObject({ to: USDS_PSM_WRAPPER, args: [getAddress(ACCOUNT), AMOUNT] });
    expect(mocks.allowance).toEqual({
      chainId: 1,
      contractAddress: L1_USDC,
      owner: getAddress(ACCOUNT),
      spender: USDS_PSM_WRAPPER
    });
  });

  it('skips the approve the allowance covers', () => {
    mocks.usdc = AMOUNT;
    render();
    expect(calls().map(call => call.functionName)).toEqual(['sellGem']);
  });

  it('reads and builds nothing while disabled, without an amount or an account', () => {
    for (const overrides of [
      { enabled: false },
      { amount: undefined },
      { amount: 0n },
      { account: undefined }
    ]) {
      render(overrides);
      expect(mocks.allowance).toMatchObject({ contractAddress: undefined });
      expect(calls()).toEqual([]);
    }
  });

  it('builds nothing while the allowance loads, and reports a failed read', () => {
    mocks.usdc = undefined;
    render();
    expect(calls()).toEqual([]);
    mocks.allowanceError = new Error('rpc down');
    expect(render().error).toBe(mocks.allowanceError);
  });

  it('reads the wrapper, liquidity and the USDC balance again before the prompt', async () => {
    render();
    mocks.refusal.mockResolvedValue(undefined);
    const client = { chain: 'ethereum' };
    await (mocks.legs!.preflight as (client: unknown) => Promise<unknown>)(client);
    expect(mocks.refusal).toHaveBeenCalledWith({ amount: AMOUNT, account: getAddress(ACCOUNT), client });
  });
});
