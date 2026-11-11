/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { getAddress } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxMutateVariables } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { useCctpBurnLegs } from './useCctpBurnLegs';

// The chain shows a burn only once it mines: while its prompt is open, a Continue of the same swap would burn the USDC twice.

type FlowArgs = {
  calls: TxMutateVariables[];
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
  onError: (error: Error, hash: string, variables?: TxMutateVariables) => void;
};

const mocks = vi.hoisted(() => ({ flows: [] as FlowArgs[], execute: vi.fn(), scope: 'open-burn-scope' }));

vi.mock('wagmi', () => ({
  usePublicClient: () => ({ waitForTransactionReceipt: () => new Promise(() => undefined) })
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: ({ contractAddress }: { contractAddress?: string }) => ({
    data: contractAddress ? 0n : undefined,
    error: null,
    mutate: vi.fn()
  })
}));
vi.mock('../adapters/cctp/gate', async importOriginal => ({
  ...(await importOriginal<typeof import('../adapters/cctp/gate')>()),
  cctpBurnRefusal: async () => undefined,
  cctpResumeRefusal: async () => undefined
}));
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: true
  })
}));
vi.mock('@/hooks/shared/useSequentialTransactionFlow', () => ({
  useSequentialTransactionFlow: (args: FlowArgs) => {
    mocks.flows.push(args);
    return { prepared: true, error: null, execute: mocks.execute, reset: vi.fn(), detached: false };
  }
}));

const ACCOUNT = getAddress(BASE_BURN_TX.from);
const SWAP_HASH = '0x' + 'ab'.repeat(32);
const OTHER_SWAP_HASH = '0x' + 'ef'.repeat(32);
const BURN_HASH = '0x' + 'cd'.repeat(32);
const PROMPT_OPEN = 'Approve or reject the request in your wallet before sending again.';
let scopeSeq = 0;

/** One Review's legs: a new bridge, or a Continue of `resume`. */
function mount(resume?: UnfinishedCctpSwap) {
  const callbacks: TxCallbacks = {
    onMutate: vi.fn(),
    onStart: vi.fn(),
    onSuccess: vi.fn(),
    onError: vi.fn()
  };
  const view = renderHook(() =>
    useCctpBurnLegs({
      enabled: true,
      from: 'base',
      chainId: 8453,
      ethereumChainId: 1,
      account: ACCOUNT,
      recipient: BASE_BURN_MINT_RECIPIENT,
      amount: BASE_BURN_AMOUNT * 10n ** 12n,
      scope: mocks.scope,
      resume,
      getCallbacks: () => callbacks
    })
  );
  const flow = mocks.flows.at(-1)!;
  const leg = (name: string) =>
    flow.calls.find(call => (call as { functionName?: string }).functionName === name)!;
  return {
    flow,
    leg,
    callbacks,
    confirm: () => act(async () => view.result.current.execute()),
    close: () => act(() => view.result.current.reset())
  };
}
const swapOf = (hash: string): UnfinishedCctpSwap => ({
  swapTxHash: hash,
  network: 'base',
  usdcAmount: BASE_BURN_AMOUNT,
  recipient: BASE_BURN_MINT_RECIPIENT.toLowerCase(),
  at: 1
});
const refusedWith = (callbacks: TxCallbacks) =>
  vi.mocked(callbacks.onError).mock.calls.map(([error]) => (error as Error).message);

describe('useCctpBurnLegs: a Continue while a burn of the same swap is open in the wallet', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.scope = `open-burn-scope-${++scopeSeq}`;
    mocks.flows = [];
    mocks.execute.mockClear();
  });

  it('refuses a Continue of a swap whose burn a new bridge left open after X, until that burn is rejected', async () => {
    const first = mount();
    await first.confirm();
    const swap = first.leg('swapExactIn');
    const burn = first.leg('depositForBurn');
    act(() => {
      first.flow.onMutate(swap);
      first.flow.onStart(SWAP_HASH, swap);
      first.flow.onMutate(burn);
    });
    first.close();
    const card = cctpSwapStore.getSnapshot(mocks.scope)[0];
    expect(card.swapTxHash).toBe(SWAP_HASH);
    const next = mount(card);
    mocks.execute.mockClear();
    await next.confirm();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(refusedWith(next.callbacks)).toEqual([PROMPT_OPEN]);
    act(() => first.flow.onError(new Error('User rejected the request'), '', burn));
    await next.confirm();
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it('refuses a second Continue of a swap while the first one’s burn is open, and holds it no longer once signed', async () => {
    const first = mount(swapOf(SWAP_HASH));
    await first.confirm();
    const burn = first.leg('depositForBurn');
    act(() => first.flow.onMutate(burn));
    first.close();
    const next = mount(swapOf(SWAP_HASH));
    mocks.execute.mockClear();
    await next.confirm();
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(refusedWith(next.callbacks)).toEqual([PROMPT_OPEN]);
    act(() => first.flow.onStart(BURN_HASH, burn));
    await next.confirm();
    expect(mocks.execute).toHaveBeenCalledOnce();
  });

  it('holds no other swap, and no new bridge', async () => {
    const first = mount(swapOf(SWAP_HASH));
    await first.confirm();
    act(() => first.flow.onMutate(first.leg('depositForBurn')));
    first.close();
    mocks.execute.mockClear();
    await mount(swapOf(OTHER_SWAP_HASH)).confirm();
    await mount().confirm();
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
