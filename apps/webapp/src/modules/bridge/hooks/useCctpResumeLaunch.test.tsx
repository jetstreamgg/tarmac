/**
 * @vitest-environment happy-dom
 */
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import type { BridgeLaunchForm } from './useBridgeLaunch';
import { useCctpResumeLaunch } from './useCctpResumeLaunch';

const BASE: UnfinishedCctpSwap = {
  swapTxHash: '0x5a',
  network: 'base',
  usdcAmount: 250n * 10n ** 6n,
  recipient: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  at: 1
};
const OPTIMISM: UnfinishedCctpSwap = { ...BASE, swapTxHash: '0x6b', network: 'optimism', usdcAmount: 7n };

type Opened = { form: BridgeLaunchForm; resume: UnfinishedCctpSwap | undefined };

const mocks = vi.hoisted(() => ({
  opened: [] as Opened[],
  resumes: [] as (UnfinishedCctpSwap | undefined)[],
  onSuccess: undefined as (() => void) | undefined
}));

vi.mock('./useCctpResumeForm', () => ({
  useCctpResumeForm: (swap: UnfinishedCctpSwap | undefined) => ({
    form: {
      amount: swap?.usdcAmount ?? 0n,
      from: swap?.network ?? 'base',
      to: 'ethereum',
      route: undefined,
      recipient: undefined,
      isConnected: true,
      reviewBlocked: !swap
    },
    blockedReason: undefined
  })
}));
vi.mock('./useBridgeLaunch', () => ({
  useBridgeLaunch: (
    form: BridgeLaunchForm,
    onSuccess: () => void,
    resume: UnfinishedCctpSwap | undefined
  ) => {
    mocks.resumes.push(resume);
    mocks.onSuccess = onSuccess;
    // Each render's launch opens the modal with that render's form.
    return { launch: () => mocks.opened.push({ form, resume }), locked: false, restore: vi.fn() };
  }
}));

describe('useCctpResumeLaunch', () => {
  beforeEach(() => {
    Object.assign(mocks, { opened: [], resumes: [], onSuccess: undefined });
  });

  it("opens the modal once, with the continued swap's form", () => {
    const { result } = renderHook(() => useCctpResumeLaunch());
    expect(mocks.opened).toEqual([]);
    act(() => result.current.launch(BASE));
    expect(mocks.opened).toEqual([
      { form: expect.objectContaining({ from: 'base', amount: BASE.usdcAmount }), resume: BASE }
    ]);
  });

  it('opens once under Strict Mode', () => {
    const { result } = renderHook(() => useCctpResumeLaunch(), { wrapper: StrictMode });
    act(() => result.current.launch(BASE));
    expect(mocks.opened).toHaveLength(1);
  });

  it('opens nothing again on a later render', () => {
    const { result, rerender } = renderHook(() => useCctpResumeLaunch());
    act(() => result.current.launch(BASE));
    rerender();
    rerender();
    expect(mocks.opened).toHaveLength(1);
  });

  it('opens each card it is launched from, the same one again included', () => {
    const { result } = renderHook(() => useCctpResumeLaunch());
    act(() => result.current.launch(BASE));
    act(() => result.current.launch(OPTIMISM));
    act(() => result.current.launch(OPTIMISM));
    expect(mocks.opened.map(({ form, resume }) => [form.from, resume])).toEqual([
      ['base', BASE],
      ['optimism', OPTIMISM],
      ['optimism', OPTIMISM]
    ]);
  });

  // The swap leaves the store once its burn is sent; the launch keeps it until the bridge succeeds.
  it('keeps the swap until its bridge succeeds', () => {
    const { result, rerender } = renderHook(() => useCctpResumeLaunch());
    act(() => result.current.launch(BASE));
    rerender();
    expect(mocks.resumes.at(-1)).toBe(BASE);
    act(() => mocks.onSuccess?.());
    expect(mocks.resumes.at(-1)).toBeUndefined();
    expect(mocks.opened).toHaveLength(1);
  });

  it('tells its caller once the bridge succeeds, after letting the swap go', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useCctpResumeLaunch(onSuccess));
    act(() => result.current.launch(BASE));
    expect(onSuccess).not.toHaveBeenCalled();
    act(() => mocks.onSuccess?.());
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(mocks.resumes.at(-1)).toBeUndefined();
  });
});
