import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpgradeDeepLink } from './useUpgradeDeepLink';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  setSearchParams: vi.fn(),
  search: ''
}));

vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => [new URLSearchParams(mocks.search), mocks.setSearchParams]
}));

vi.mock('./useUpgradeModal', () => ({
  useUpgradeModal: () => ({ open: mocks.open })
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
});
