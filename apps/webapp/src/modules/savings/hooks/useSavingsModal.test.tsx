/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// The `t` macro resolves against the global i18n singleton (empty catalog → source strings).
i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ launchMock: vi.fn() }));

// Capture the config handed to launch() — the only channel the trigger speaks through.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launchMock })
}));

// Stub the collaborator body: the hook's job is to wire its props (flow/sessionId/preset),
// not to render it. The real form is covered by its own specs.
vi.mock('../components/SavingsModalForm', () => ({
  SavingsModalForm: () => null
}));

import { useSavingsModal } from './useSavingsModal';
import type { SavingsModalPreset } from '../components/SavingsModalForm';

type LaunchConfig = Parameters<typeof h.launchMock>[0];
// The backgroundContent element's props — React 19 types ReactElement.props as `unknown`.
type BodyElement = ReactElement<{ flow: string; sessionId: string; preset?: SavingsModalPreset }>;

describe('useSavingsModal', () => {
  beforeEach(() => h.launchMock.mockClear());
  afterEach(() => cleanup());

  it('openSupply launches the supply modal and hosts the supply body in its own session', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSavingsModal({ onSuccess }));
    act(() => result.current.openSupply());

    expect(h.launchMock).toHaveBeenCalledTimes(1);
    const config: LaunchConfig = h.launchMock.mock.calls[0][0];
    expect(config.title).toBe('Supply to Sky Savings');
    // Three-screen flow: the entry advances to the review ("Review"), the
    // review's Confirm fires the engine.
    expect(config.entry).toEqual({ confirmLabel: 'Review', confirmDisabled: true });
    expect(config.reviewTitle).toBe('Review supply');
    expect(config.confirmLabel).toBe('Confirm');
    expect(config.onSuccess).toBe(onSuccess);
    expect(typeof config.sessionId).toBe('string');

    const body = config.backgroundContent as BodyElement;
    expect(body.props.flow).toBe('supply');
    // The host shares the config's session so updateModalContent reaches this body.
    expect(body.props.sessionId).toBe(config.sessionId);
    // No preset → opens empty.
    expect(body.props.preset).toBeUndefined();
  });

  it('threads a preset (amount/token) into the supply body', () => {
    const { result } = renderHook(() => useSavingsModal());
    act(() => result.current.openSupply({ amount: '100', token: 'USDS' }));

    const config: LaunchConfig = h.launchMock.mock.calls[0][0];
    const body = config.backgroundContent as BodyElement;
    expect(body.props.preset).toEqual({ amount: '100', token: 'USDS' });
  });

  it('openWithdraw launches the withdraw modal in a session distinct from supply', () => {
    const { result } = renderHook(() => useSavingsModal());
    act(() => result.current.openSupply());
    act(() => result.current.openWithdraw());

    const supplyCfg: LaunchConfig = h.launchMock.mock.calls[0][0];
    const withdrawCfg: LaunchConfig = h.launchMock.mock.calls[1][0];
    expect(withdrawCfg.title).toBe('Withdraw from Sky Savings');
    expect(withdrawCfg.entry).toEqual({ confirmLabel: 'Review', confirmDisabled: true });
    expect(withdrawCfg.reviewTitle).toBe('Review withdraw');
    expect((withdrawCfg.backgroundContent as BodyElement).props.flow).toBe('withdraw');
    // Sibling sessions must differ so their live updates never cross-talk.
    expect(withdrawCfg.sessionId).not.toBe(supplyCfg.sessionId);
  });
});
