import { createElement, StrictMode, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpgradeDeepLink } from './useUpgradeDeepLink';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  setSearchParams: vi.fn(),
  trackWidgetSelected: vi.fn(),
  startNewFlow: vi.fn(),
  search: '',
  pathname: '/convert'
}));

vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => [new URLSearchParams(mocks.search), mocks.setSearchParams]
}));

vi.mock('./useUpgradeModal', () => ({
  useUpgradeModal: () => ({ open: mocks.open })
}));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: mocks.pathname } })
}));

vi.mock('wagmi', () => ({
  useChainId: () => 1
}));

vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({ trackWidgetSelected: mocks.trackWidgetSelected })
}));

vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: mocks.startNewFlow })
}));

/** Applies the recorded setSearchParams updater to the current search. */
const appliedParams = () => {
  const [updater, opts] = mocks.setSearchParams.mock.calls[0];
  return { params: updater(new URLSearchParams(mocks.search)) as URLSearchParams, opts };
};

describe('useUpgradeDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the modal with MKR preselected and strips only the upgrade param', () => {
    mocks.search = 'upgrade=mkr&network=ethereum';
    renderHook(() => useUpgradeDeepLink());

    expect(mocks.open).toHaveBeenCalledWith('MKR');
    const { params, opts } = appliedParams();
    expect(params.has('upgrade')).toBe(false);
    expect(params.get('network')).toBe('ethereum');
    expect(opts).toEqual({ replace: true });
  });

  it('accepts values case-insensitively', () => {
    mocks.search = 'upgrade=DAI';
    renderHook(() => useUpgradeDeepLink());

    expect(mocks.open).toHaveBeenCalledWith('DAI');
  });

  it('strips unknown values without opening the modal', () => {
    mocks.search = 'upgrade=usdc';
    renderHook(() => useUpgradeDeepLink());

    expect(mocks.open).not.toHaveBeenCalled();
    expect(appliedParams().params.has('upgrade')).toBe(false);
  });

  it('does nothing when the param is absent', () => {
    mocks.search = 'network=ethereum';
    renderHook(() => useUpgradeDeepLink());

    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.setSearchParams).not.toHaveBeenCalled();
  });

  it('rotates the flow and emits app_widget_selected for the upgrade modal', () => {
    mocks.search = 'upgrade=mkr';
    mocks.pathname = '/portfolio';
    renderHook(() => useUpgradeDeepLink());

    expect(mocks.startNewFlow).toHaveBeenCalledOnce();
    expect(mocks.trackWidgetSelected).toHaveBeenCalledWith({
      widgetName: 'upgrade',
      previousWidget: 'balances',
      selectionMethod: 'deeplink',
      chainId: 1
    });
  });

  it('does not emit for unknown values', () => {
    mocks.search = 'upgrade=usdc';
    renderHook(() => useUpgradeDeepLink());

    expect(mocks.trackWidgetSelected).not.toHaveBeenCalled();
  });

  it('opens and emits once under StrictMode double-run (J6)', () => {
    mocks.search = 'upgrade=dai';
    renderHook(() => useUpgradeDeepLink(), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children)
    });

    expect(mocks.open).toHaveBeenCalledOnce();
    expect(mocks.trackWidgetSelected).toHaveBeenCalledOnce();
  });
});
