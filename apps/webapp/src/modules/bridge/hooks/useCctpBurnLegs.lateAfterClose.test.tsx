/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { getAddress } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxMutateVariables } from '@/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import { cctpSwapStore } from '../store/cctpSwapStore';
import { useCctpBurnLegs } from './useCctpBurnLegs';

// X abandons the run, but a prompt the wallet still shows can be signed after it: that swap or burn moved funds.

type FlowArgs = {
  calls: TxMutateVariables[];
  onMutate: (variables?: TxMutateVariables) => void;
  onStart: (hash?: string, variables?: TxMutateVariables) => void;
};

const mocks = vi.hoisted(() => ({
  flows: [] as FlowArgs[],
  scope: 'late-scope',
  callbacks: undefined as unknown as TxCallbacks
}));

vi.mock('wagmi', () => ({
  // A late send is followed to a receipt that, here, never comes.
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
  cctpBurnRefusal: async () => undefined
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
    return { prepared: true, error: null, execute: vi.fn(), reset: vi.fn() };
  }
}));

const ACCOUNT = getAddress(BASE_BURN_TX.from);
const SWAP_HASH = '0x' + 'ab'.repeat(32);
const BURN_HASH = '0x' + 'cd'.repeat(32);
let scopeSeq = 0;

const render = () =>
  renderHook(() =>
    useCctpBurnLegs({
      enabled: true,
      from: 'base',
      chainId: 8453,
      ethereumChainId: 1,
      account: ACCOUNT,
      recipient: BASE_BURN_MINT_RECIPIENT,
      amount: BASE_BURN_AMOUNT * 10n ** 12n,
      scope: mocks.scope,
      getCallbacks: () => mocks.callbacks
    })
  );
const flow = () => mocks.flows.at(-1)!;
const leg = (name: string) =>
  flow().calls.find(call => (call as { functionName?: string }).functionName === name)!;
const swaps = () => cctpSwapStore.getSnapshot(mocks.scope);
// Confirm: the preflight resolves and the engine starts the run.
const confirm = async (view: ReturnType<typeof render>) => {
  await act(async () => view.result.current.execute());
};

describe('useCctpBurnLegs: a leg signed after the modal was closed with X', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.scope = `late-scope-${++scopeSeq}`;
    mocks.flows = [];
    mocks.callbacks = { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() };
  });

  it('keeps a swap signed after X to continue, though the run sends nothing after it', async () => {
    const view = render();
    await confirm(view);
    const swap = leg('swapExactIn');
    act(() => flow().onMutate(swap));
    // X: the run is dropped while the swap prompt is still open in the wallet.
    act(() => view.result.current.reset());
    act(() => flow().onStart(SWAP_HASH, swap));
    expect(swaps().map(entry => [entry.swapTxHash, entry.burn])).toEqual([[SWAP_HASH, undefined]]);
    // The swap is no send: the modal hears nothing of it.
    expect(mocks.callbacks.onStart).not.toHaveBeenCalled();
  });

  it('links a burn signed after X to its swap, and reports it to its Confirm to be recorded', async () => {
    const view = render();
    await confirm(view);
    const swap = leg('swapExactIn');
    const burn = leg('depositForBurn');
    act(() => {
      flow().onMutate(swap);
      flow().onStart(SWAP_HASH, swap);
      flow().onMutate(burn);
    });
    act(() => view.result.current.reset());
    act(() => flow().onStart(BURN_HASH, burn));
    expect(swaps().map(entry => [entry.swapTxHash, entry.burn])).toEqual([[SWAP_HASH, BURN_HASH]]);
    expect(mocks.callbacks.onStart).toHaveBeenLastCalledWith(BURN_HASH);
  });
});
