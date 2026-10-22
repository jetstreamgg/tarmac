/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { getAddress, type Call } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { L1_USDC, USDS_PSM_WRAPPER, cctpL2Contracts } from '../adapters/cctp/contracts';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { isCctpSpendOpen, openCctpSpend } from '../store/openCctpSpends';
import { useCctpConvertLegs } from './useCctpConvertLegs';

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const AMOUNT = 250n * 10n ** 6n;

const mocks = vi.hoisted(() => ({
  allowance: undefined as undefined | Record<string, unknown>,
  usdc: 0n as bigint | undefined,
  allowanceError: null as Error | null,
  legs: undefined as undefined | Record<string, unknown>,
  refusal: vi.fn(),
  l2Refusal: vi.fn(),
  resumeRefusal: vi.fn()
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
vi.mock('../adapters/cctp/gate', () => ({
  CCTP_SWAP_FAILED_MESSAGE: 'The swap of this bridge failed, so there is nothing to bridge.',
  cctpConvertRefusal: mocks.refusal,
  cctpL2ConvertRefusal: mocks.l2Refusal,
  cctpResumeRefusal: mocks.resumeRefusal
}));
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
    mocks.l2Refusal.mockReset();
    mocks.resumeRefusal.mockReset();
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

  describe('on an L2, for a stopped bridge', () => {
    const { psm3, usds, usdc } = cctpL2Contracts('base');
    const SCOPE = 'bridgeCctpSwap:test';
    const SWAP: UnfinishedCctpSwap = {
      swapTxHash: '0x' + 'ab'.repeat(32),
      network: 'base',
      usdcAmount: AMOUNT,
      recipient: getAddress(ACCOUNT),
      at: 1
    };
    const renderL2 = (overrides: Partial<Parameters<typeof useCctpConvertLegs>[0]> = {}) =>
      render({ swap: SWAP, scope: SCOPE, chainId: 8453, ...overrides });
    const preflight = (client: unknown) =>
      (mocks.legs!.preflight as (client: unknown) => Promise<Error | undefined>)(client);
    const stored = () => cctpSwapStore.getSnapshot(SCOPE).find(entry => entry.swapTxHash === SWAP.swapTxHash);
    const leg = (functionName: string) => ({ functionName }) as never;

    beforeEach(() => {
      localStorage.clear();
      cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
      cctpSwapStore.record(SCOPE, SWAP);
    });

    it('approves PSM3 when short, then swaps the amount 1:1 for USDS to the same account, the swap recorded as sent', () => {
      renderL2();
      expect(mocks.legs).toMatchObject({ chainId: 8453, sendFunctionName: 'swapExactIn' });
      expect(calls().map(call => [call.to, call.functionName])).toEqual([
        [usdc, 'approve'],
        [psm3, 'swapExactIn']
      ]);
      expect(calls()[1].args).toEqual([usdc, usds, AMOUNT, AMOUNT * 10n ** 12n, getAddress(ACCOUNT), 0n]);
      expect(mocks.allowance).toEqual({
        chainId: 8453,
        contractAddress: usdc,
        owner: getAddress(ACCOUNT),
        spender: psm3
      });
    });

    it("checks on the chain that the swap's USDC is all still here, then PSM3's quote, USDS and the balance", async () => {
      renderL2();
      mocks.resumeRefusal.mockResolvedValue(undefined);
      mocks.l2Refusal.mockResolvedValue(undefined);
      const client = { chain: 'base' };
      await expect(preflight(client)).resolves.toBeUndefined();
      expect(mocks.resumeRefusal).toHaveBeenCalledWith({
        network: 'base',
        swapTxHash: SWAP.swapTxHash,
        account: getAddress(ACCOUNT),
        usdcAmount: AMOUNT,
        recipient: SWAP.recipient,
        client
      });
      expect(mocks.l2Refusal).toHaveBeenCalledWith({
        network: 'base',
        amount: AMOUNT,
        account: getAddress(ACCOUNT),
        client
      });
      expect(mocks.refusal).not.toHaveBeenCalled();
    });

    it('converts nothing once USDC left the wallet after the swap, and drops a swap that failed', async () => {
      renderL2();
      const left = new Error('USDC left this wallet after the swap');
      mocks.resumeRefusal.mockResolvedValueOnce(left);
      await expect(preflight({})).resolves.toBe(left);
      expect(mocks.l2Refusal).not.toHaveBeenCalled();
      expect(stored()).toBeDefined();
      mocks.resumeRefusal.mockResolvedValueOnce(
        new Error('The swap of this bridge failed, so there is nothing to bridge.')
      );
      await expect(preflight({})).resolves.toBeInstanceOf(Error);
      expect(stored()).toBeUndefined();
    });

    it('refuses while a burn or convert of the swap is open in the wallet, or once it was sent or settled', async () => {
      renderL2();
      mocks.resumeRefusal.mockResolvedValue(undefined);
      mocks.l2Refusal.mockResolvedValue(undefined);
      const release = openCctpSpend(SCOPE, SWAP.swapTxHash);
      await expect(preflight({})).resolves.toBeInstanceOf(Error);
      release();
      cctpSwapStore.markConvert(SCOPE, SWAP.swapTxHash, '0xconvert');
      await expect(preflight({})).resolves.toBeInstanceOf(Error);
      cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
      await expect(preflight({})).resolves.toBeInstanceOf(Error);
      expect(mocks.resumeRefusal).not.toHaveBeenCalled();
    });

    it('holds the swap while its convert prompt is open, and links the convert sent, one leg or a bundle', () => {
      renderL2();
      const onLegPrompt = mocks.legs!.onLegPrompt as (variables: unknown) => (() => void) | undefined;
      const onLegSent = mocks.legs!.onLegSent as (hash: string, variables: unknown) => void;
      const onCallsSent = mocks.legs!.onCallsSent as (id: string) => void;
      expect(onLegPrompt(leg('approve'))).toBeUndefined();
      const release = onLegPrompt(leg('swapExactIn'))!;
      expect(isCctpSpendOpen(SCOPE, SWAP.swapTxHash)).toBe(true);
      release();
      expect(isCctpSpendOpen(SCOPE, SWAP.swapTxHash)).toBe(false);
      onLegSent('0xapprove', leg('approve'));
      expect(stored()?.convert).toBeUndefined();
      onLegSent('0xconvert', leg('swapExactIn'));
      expect(stored()?.convert).toBe('0xconvert');
      onCallsSent('bundle-id');
      expect(stored()?.convert).toBe('bundle-id');
    });

    it('unlinks a convert that reverted or was replaced, not one sent since', () => {
      renderL2();
      const onLegSent = mocks.legs!.onLegSent as (hash: string, variables: unknown) => void;
      const onLegFailed = mocks.legs!.onLegFailed as (hash: string) => void;
      onLegSent('0xold', leg('swapExactIn'));
      onLegSent('0xnew', leg('swapExactIn'));
      onLegFailed('0xold');
      expect(stored()?.convert).toBe('0xnew');
      onLegFailed('0xnew');
      expect(stored()?.convert).toBeUndefined();
    });
  });
});
