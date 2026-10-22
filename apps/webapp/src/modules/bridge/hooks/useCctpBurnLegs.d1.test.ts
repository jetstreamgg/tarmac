/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { getAddress, type Call } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from '../adapters/cctp/cctpFixtures';
import { useCctpBurnLegs } from './useCctpBurnLegs';

const mocks = vi.hoisted(() => ({
  clients: {} as Record<number, unknown>,
  legs: undefined as undefined | Record<string, unknown>,
  execute: vi.fn(),
  record: vi.fn(),
  clear: vi.fn(),
  markBurn: vi.fn()
}));

vi.mock('wagmi', () => ({
  usePublicClient: ({ chainId }: { chainId?: number }) => (chainId ? mocks.clients[chainId] : undefined)
}));
vi.mock('@/hooks', () => ({
  useTokenAllowance: (params: Record<string, unknown>) => ({
    data: params.contractAddress ? 0n : undefined,
    error: null,
    mutate: vi.fn()
  })
}));
vi.mock('../adapters/cctp/gate', () => ({
  cctpBurnRefusal: vi.fn(),
  cctpResumeRefusal: vi.fn(),
  CCTP_SWAP_FAILED_MESSAGE: 'The swap of this bridge failed, so there is nothing to bridge.'
}));
vi.mock('../store/cctpSwapStore', () => ({
  cctpSwapStore: { record: mocks.record, clear: mocks.clear, markBurn: mocks.markBurn }
}));
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => true }));
// The real engine calls onLegSent for a leg signed after its run ended too, with the context its run was executed with.
vi.mock('./useBridgeCallLegs', () => ({
  useBridgeCallLegs: (params: Record<string, unknown>) => {
    mocks.legs = params;
    return {
      isBatch: false,
      ready: true,
      error: null,
      execute: mocks.execute,
      reset: vi.fn(),
      stop: vi.fn()
    };
  }
}));

const BASE = 8453;
const ETHEREUM = 1;
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n;
const getCallbacks = () => ({}) as TxCallbacks;
const SCOPE = 'scope';
const R2 = '0x1111111111111111111111111111111111111111';
const X = '0x' + 'ab'.repeat(32);
const Y = '0x' + '12'.repeat(32);
const LATE_HASH = '0x' + 'cd'.repeat(32);
const RESUME_X = {
  swapTxHash: X,
  network: 'base' as const,
  usdcAmount: BASE_BURN_AMOUNT,
  recipient: BASE_BURN_MINT_RECIPIENT.toLowerCase(),
  at: 0
};
const RESUME_Y = { ...RESUME_X, swapTxHash: Y };

type Props = { resume?: typeof RESUME_X; recipient: string };
const renderLegs = (initialProps: Props) =>
  renderHook(
    ({ resume, recipient }: Props) =>
      useCctpBurnLegs({
        enabled: true,
        from: 'base',
        chainId: BASE,
        ethereumChainId: ETHEREUM,
        account: BASE_BURN_TX.from,
        recipient,
        amount: AMOUNT,
        getCallbacks,
        scope: SCOPE,
        resume
      }),
    { initialProps }
  );

const calls = () => mocks.legs!.calls as Call[];
const byName = (name: string) =>
  calls().find(call => (call as { functionName?: string }).functionName === name)!;
const onLegSent = () => mocks.legs!.onLegSent as (hash: string, variables: object, context: unknown) => void;
// The context run 1 handed the engine, which the engine pins to every prompt that run opens.
const run1Context = () => mocks.execute.mock.calls[0][0];

describe('useCctpBurnLegs with a leg signed after another run started', () => {
  beforeEach(() => {
    mocks.clients = { [BASE]: { chain: 'base' }, [ETHEREUM]: { chain: 'ethereum' } };
    mocks.legs = undefined;
    mocks.execute.mockReset();
    mocks.record.mockReset();
    mocks.clear.mockReset();
    mocks.markBurn.mockReset();
  });

  it('(A) run 1 continues X, run 2 continues Y: run 1 late burn is linked to X, not Y', () => {
    const { result, rerender } = renderLegs({ resume: RESUME_X, recipient: BASE_BURN_MINT_RECIPIENT });
    act(() => result.current.execute());
    const run1Burn = byName('depositForBurn');

    rerender({ resume: RESUME_Y, recipient: BASE_BURN_MINT_RECIPIENT });
    act(() => result.current.execute());
    expect(mocks.execute).toHaveBeenCalledTimes(2);

    // Run 1's burn prompt is signed late, after run 2 started.
    act(() => onLegSent()(LATE_HASH, run1Burn, run1Context()));

    expect(mocks.markBurn).not.toHaveBeenCalledWith(SCOPE, Y, expect.anything());
    expect(mocks.markBurn).toHaveBeenCalledWith(SCOPE, X, LATE_HASH);
  });

  it('(B) run 1 fresh to R1, run 2 fresh to R2: run 1 late swap is recorded under R1', () => {
    const { result, rerender } = renderLegs({ recipient: BASE_BURN_MINT_RECIPIENT });
    act(() => result.current.execute());
    const run1Swap = byName('swapExactIn');

    rerender({ recipient: R2 });
    act(() => result.current.execute());
    expect(mocks.execute).toHaveBeenCalledTimes(2);

    // Run 1's swap prompt is signed late, after run 2 started.
    act(() => onLegSent()(LATE_HASH, run1Swap, run1Context()));

    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(mocks.record.mock.calls[0][1].recipient).toBe(getAddress(BASE_BURN_MINT_RECIPIENT));
  });
});
