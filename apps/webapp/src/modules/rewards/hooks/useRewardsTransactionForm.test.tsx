import { i18n } from '@lingui/core';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import { TOKENS } from '@/hooks';
import { useRewardsTransactionForm } from './useRewardsTransactionForm';

// The `t` macro resolves against the global i18n singleton (not React context).
i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;
const CONTRACT = '0x0650CAF159C5A49f711e8169D4336ECB9b950275' as const;

// Shared mutable state for the module mocks below. `vi.hoisted` runs before the
// `vi.mock` factories so they can close over it.
const h = vi.hoisted(() => ({
  walletBalance: undefined as { value: bigint } | undefined,
  suppliedBalance: undefined as bigint | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useTokenBalance: () => ({ data: h.walletBalance }),
    useRewardsSuppliedBalance: () => ({ data: h.suppliedBalance })
  };
});

const renderForm = (flow: 'supply' | 'withdraw', amount: string) =>
  renderHook(() =>
    useRewardsTransactionForm({
      flow,
      contractAddress: CONTRACT,
      supplyToken: TOKENS.usds,
      preset: { amount }
    })
  );

beforeEach(() => {
  h.walletBalance = undefined;
  h.suppliedBalance = undefined;
});

describe('useRewardsTransactionForm balance gating (APP-491)', () => {
  it('never reports insufficient funds while the wallet balance is unresolved', () => {
    const { result, rerender } = renderForm('supply', '100');

    // In flight: no error, and the confirm gate stays closed rather than
    // validating against a premature 0n.
    expect(result.current.availableKnown).toBe(false);
    expect(result.current.insufficient).toBe(false);
    expect(result.current.amountReady).toBe(false);

    // The read lands below the entered amount → now it is a real error.
    h.walletBalance = { value: parseUnits('50', 18) };
    rerender();
    expect(result.current.insufficient).toBe(true);
    expect(result.current.amountReady).toBe(false);

    // And a sufficient balance opens the gate.
    h.walletBalance = { value: parseUnits('200', 18) };
    rerender();
    expect(result.current.insufficient).toBe(false);
    expect(result.current.amountReady).toBe(true);
  });

  it('gates the withdraw flow on the supplied-position read instead', () => {
    const { result, rerender } = renderForm('withdraw', '100');

    expect(result.current.availableKnown).toBe(false);
    expect(result.current.positionKnown).toBe(false);
    expect(result.current.insufficient).toBe(false);
    expect(result.current.amountReady).toBe(false);

    h.suppliedBalance = parseUnits('60', 18);
    rerender();
    expect(result.current.positionKnown).toBe(true);
    expect(result.current.insufficient).toBe(true);
  });
});
