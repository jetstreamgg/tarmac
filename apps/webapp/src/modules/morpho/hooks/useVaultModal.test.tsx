import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { Token } from '@/hooks';

const h = vi.hoisted(() => ({ launch: vi.fn() }));

// Capture what launch() is handed — the launcher is the unit under test.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launch })
}));

// Stub the flow component — only its props are asserted.
vi.mock('../components/VaultModalForm', () => ({
  VaultModalForm: () => null
}));

import { useVaultModal } from './useVaultModal';
import { VaultModalForm } from '../components/VaultModalForm';

const ASSET = { symbol: 'USDC', address: { 1: '0xusdc' } } as unknown as Token;
const ARGS = {
  vaultAddress: '0xvault' as `0x${string}`,
  assetToken: ASSET,
  vaultName: 'USDC Risk Capital',
  netRate: 0.0445
};

type Launch = { sessionId?: string; supportedChainIds: number[]; render: () => ReactElement };
type FormElement = ReactElement<{
  flow: string;
  vaultName: string;
  netRate?: number;
  onSuccess?: () => void;
}>;
const launched = (n = 0) => h.launch.mock.calls[n][0] as Launch;
const formOf = (launch: Launch) => launch.render() as FormElement;

describe('useVaultModal', () => {
  beforeEach(() => h.launch.mockClear());
  afterEach(() => cleanup());

  it('launches the supply form for the vault on openSupply', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useVaultModal({ onSuccess }));
    act(() => result.current.openSupply(ARGS));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const launch = launched();
    expect(launch.supportedChainIds).toContain(1);
    const form = formOf(launch);
    expect(form.type).toBe(VaultModalForm);
    expect(form.props.flow).toBe('supply');
    expect(form.props.vaultName).toBe('USDC Risk Capital');
    expect(form.props.netRate).toBe(0.0445);
    expect(form.props.onSuccess).toBe(onSuccess);
  });

  it('launches the withdraw form for the vault on openWithdraw, in its own session', () => {
    const { result } = renderHook(() => useVaultModal());
    act(() => result.current.openSupply(ARGS));
    act(() => result.current.openWithdraw(ARGS));

    expect(formOf(launched(1)).props.flow).toBe('withdraw');
    expect(launched(1).sessionId).not.toBe(launched(0).sessionId);
  });
});
