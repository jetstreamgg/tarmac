/// <reference types="vite/client" />

import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

const h = vi.hoisted(() => ({ launchMock: vi.fn() }));

// Capture what launch() is handed — the only channel the trigger speaks through.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launchMock })
}));

// Stub the flow component: the hook's job is to wire its props (flow/preset/onSuccess),
// not to render it. The real form is covered by its own specs.
vi.mock('../components/SavingsModalForm', () => ({
  SavingsModalForm: () => null
}));

import { useSavingsModal } from './useSavingsModal';
import { SavingsModalForm, type SavingsModalPreset } from '../components/SavingsModalForm';

type Launch = { sessionId?: string; supportedChainIds: number[]; render: () => ReactElement };
type FormElement = ReactElement<{ flow: string; preset?: SavingsModalPreset; onSuccess?: () => void }>;

const launched = (n = 0) => h.launchMock.mock.calls[n][0] as Launch;
const formOf = (launch: Launch) => launch.render() as FormElement;

describe('useSavingsModal', () => {
  beforeEach(() => h.launchMock.mockClear());
  afterEach(() => cleanup());

  it('openSupply launches the supply form as the flow, in its own session', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSavingsModal({ onSuccess }));
    act(() => result.current.openSupply());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const launch = launched();
    expect(typeof launch.sessionId).toBe('string');
    expect(launch.supportedChainIds).toContain(1);

    const form = formOf(launch);
    expect(form.type).toBe(SavingsModalForm);
    expect(form.props.flow).toBe('supply');
    expect(form.props.preset).toBeUndefined();
    expect(form.props.onSuccess).toBe(onSuccess);
  });

  it('threads a preset (amount/token) into the supply form', () => {
    const { result } = renderHook(() => useSavingsModal());
    act(() => result.current.openSupply({ amount: '100', token: 'USDS' }));
    expect(formOf(launched()).props.preset).toEqual({ amount: '100', token: 'USDS' });
  });

  it('openWithdraw launches the withdraw form in a session distinct from supply', () => {
    const { result } = renderHook(() => useSavingsModal());
    act(() => result.current.openSupply());
    act(() => result.current.openWithdraw());

    const supply = launched(0);
    const withdraw = launched(1);
    expect(formOf(withdraw).props.flow).toBe('withdraw');
    expect(withdraw.sessionId).not.toBe(supply.sessionId);
  });
});
