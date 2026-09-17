import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

const h = vi.hoisted(() => ({ launch: vi.fn() }));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launch })
}));

vi.mock('../components/StUsdsModalForm', () => ({
  StUsdsModalForm: () => null
}));

import { useStUsdsModal } from './useStUsdsModal';
import { StUsdsModalForm, type StUsdsModalPreset } from '../components/StUsdsModalForm';

type Launch = { sessionId?: string; supportedChainIds: number[]; render: () => ReactElement };
type FormElement = ReactElement<{ flow: string; preset?: StUsdsModalPreset; onSuccess?: () => void }>;
const launched = (n = 0) => h.launch.mock.calls[n][0] as Launch;
const formOf = (launch: Launch) => launch.render() as FormElement;

describe('useStUsdsModal', () => {
  beforeEach(() => h.launch.mockClear());
  afterEach(() => cleanup());

  it('launches the supply form with the preset on openSupply', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useStUsdsModal({ onSuccess }));
    act(() => result.current.openSupply({ amount: '100' }));

    expect(h.launch).toHaveBeenCalledTimes(1);
    expect(launched().supportedChainIds).toContain(1);
    const form = formOf(launched());
    expect(form.type).toBe(StUsdsModalForm);
    expect(form.props.flow).toBe('supply');
    expect(form.props.preset).toEqual({ amount: '100' });
    expect(form.props.onSuccess).toBe(onSuccess);
  });

  it('launches the withdraw form on openWithdraw', () => {
    const { result } = renderHook(() => useStUsdsModal());
    act(() => result.current.openWithdraw());
    expect(formOf(launched()).props.flow).toBe('withdraw');
  });

  it('mints distinct sessions for supply and withdraw so sibling modals never cross-talk', () => {
    const { result } = renderHook(() => useStUsdsModal());
    act(() => result.current.openSupply());
    act(() => result.current.openWithdraw());
    expect(launched(0).sessionId).toBeDefined();
    expect(launched(1).sessionId).toBeDefined();
    expect(launched(0).sessionId).not.toBe(launched(1).sessionId);
  });
});
