import { renderHook } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionPreflight } from '@/modules/ui/context/preTransactionGate';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  chainId: 1,
  preflight: { kind: 'clear' } as TransactionPreflight,
  contexts: [] as Array<{ usdValue: number | undefined; actionable: boolean }>
}));
vi.mock('wagmi', async io => ({ ...(await io<typeof import('wagmi')>()), useChainId: () => h.chainId }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransactionPreflight: (context: { usdValue: number | undefined; actionable: boolean }) => {
    h.contexts.push(context);
    return h.preflight;
  }
}));

import { useStakeConfirmHold } from './useStakeConfirmHold';

const run = (over: Partial<Parameters<typeof useStakeConfirmHold>[0]> = {}) =>
  renderHook(() =>
    useStakeConfirmHold({ usdValue: 1_000, actionable: true, launchErrorMessage: null, ...over })
  ).result.current;

describe('useStakeConfirmHold', () => {
  beforeEach(() => {
    h.chainId = 1;
    h.preflight = { kind: 'clear' };
    h.contexts = [];
  });

  it('is live on mainnet with a clear verdict and no prepare failure', () => {
    expect(run()).toEqual({ disabled: false, loading: false, alert: null });
  });

  it('holds Confirm while the enhanced verdict is pending, and blocks it with the reason on a denial', () => {
    h.preflight = { kind: 'pending' };
    // `loading` is the hold: the DS Button's loading state disables it.
    expect(run()).toMatchObject({ disabled: false, loading: true, alert: null });

    h.preflight = { kind: 'blocked', message: 'denied' };
    expect(run()).toMatchObject({
      disabled: true,
      loading: false,
      alert: { kind: 'preflight', message: 'denied' }
    });
  });

  it('surfaces a prepare failure only when nothing compliance-related is in the way', () => {
    expect(run({ launchErrorMessage: 'simulation failed' })).toMatchObject({
      disabled: false,
      alert: { kind: 'prepare', message: 'simulation failed' }
    });
  });

  it('holds Confirm off-chain with the switch copy — the modal has no first screen to explain it (APP-528)', () => {
    h.chainId = 8453;
    const hold = run();
    expect(hold.disabled).toBe(true);
    expect(hold.loading).toBe(false);
    expect(hold.alert?.kind).toBe('chain');
    // And the screening call is not spent on a transaction that cannot fire.
    expect(h.contexts.at(-1)?.actionable).toBe(false);
  });

  it('never arms the preflight while the form itself is not actionable', () => {
    run({ actionable: false });
    expect(h.contexts.at(-1)?.actionable).toBe(false);
  });
});
