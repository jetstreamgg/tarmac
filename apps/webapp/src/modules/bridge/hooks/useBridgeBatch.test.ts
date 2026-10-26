/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SafeWalletStatus } from '@/hooks/wallet/useIsSafeWallet';
import { useBridgeBatch } from './useBridgeBatch';

const mocks = vi.hoisted(() => ({
  safeStatus: 'checking' as SafeWalletStatus,
  canBundle: true
}));

vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useSafeWalletStatus: () => mocks.safeStatus
}));
vi.mock('@/modules/ui/hooks/engineLaunch', () => ({
  useShouldUseBatch: (also: boolean) => mocks.canBundle && also
}));

const decision = () => renderHook(() => useBridgeBatch()).result.current;

describe('useBridgeBatch', () => {
  beforeEach(() => Object.assign(mocks, { safeStatus: 'checking', canBundle: true }));

  // The Safe read is cold on each chain: right after a switch to Ethereum it is still out.
  it('waits for the Safe read of a wallet that bundles, rather than send one leg at a time', () => {
    expect(decision()).toEqual({ batch: false, batchPending: true });
    mocks.safeStatus = 'not-safe';
    expect(decision()).toEqual({ batch: true, batchPending: false });
  });

  it('sends a Safe, or a wallet the Safe service could not answer for, one leg at a time', () => {
    for (const safeStatus of ['safe', 'unknown'] as const) {
      mocks.safeStatus = safeStatus;
      expect(decision()).toEqual({ batch: false, batchPending: false });
    }
  });

  it('sends one leg at a time, once the Safe read is in, for a wallet that cannot bundle', () => {
    Object.assign(mocks, { safeStatus: 'not-safe', canBundle: false });
    expect(decision()).toEqual({ batch: false, batchPending: false });
  });
});
