/// <reference types="vite/client" />

import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { LaunchOptions } from '@/modules/ui/context/transactionContract';
import { chainIdsForIntent } from '@/lib/chainAvailability';
import { Intent } from '@/lib/enums';

const h = vi.hoisted(() => ({ launchMock: vi.fn<(options: LaunchOptions) => void>() }));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launchMock })
}));

// The hook's job is to hand the flow its props; the flow is covered by its own specs.
vi.mock('../components/SavingsFlow', () => ({
  SavingsFlow: () => null
}));

import { useSavingsModal } from './useSavingsModal';
import type { SavingsModalPreset } from '../components/SavingsFlow';

type FlowElement = ReactElement<{ flow: string; preset?: SavingsModalPreset; onSuccess?: () => void }>;
const launched = (call = 0) => h.launchMock.mock.calls[call][0];
const flowOf = (options: LaunchOptions) => options.flow as FlowElement;

describe('useSavingsModal', () => {
  beforeEach(() => h.launchMock.mockClear());
  afterEach(() => cleanup());

  it('openSupply launches the supply flow, guarded to the chains Savings runs on', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSavingsModal({ onSuccess }));
    act(() => result.current.openSupply());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    expect(launched().supportedChainIds).toEqual(chainIdsForIntent(Intent.SAVINGS_INTENT));
    expect(typeof launched().sessionId).toBe('string');
    const flow = flowOf(launched());
    expect(flow.props.flow).toBe('supply');
    expect(flow.props.onSuccess).toBe(onSuccess);
    expect(flow.props.preset).toBeUndefined();
  });

  it('threads a preset (amount/token) into the supply flow', () => {
    const { result } = renderHook(() => useSavingsModal());
    act(() => result.current.openSupply({ amount: '100', token: 'USDS' }));

    expect(flowOf(launched()).props.preset).toEqual({ amount: '100', token: 'USDS' });
  });

  it('openWithdraw launches the withdraw flow in a session distinct from supply', () => {
    const { result } = renderHook(() => useSavingsModal());
    act(() => result.current.openSupply());
    act(() => result.current.openWithdraw());

    expect(flowOf(launched(1)).props.flow).toBe('withdraw');
    expect(launched(1).sessionId).not.toBe(launched(0).sessionId);
  });
});
