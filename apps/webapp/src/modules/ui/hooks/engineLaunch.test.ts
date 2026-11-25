/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBatchSupportPending, useShouldUseBatch } from './engineLaunch';

const mocks = vi.hoisted(() => ({
  enabled: true,
  isLoading: true,
  supported: undefined as boolean | undefined
}));

vi.mock('@/hooks', () => ({
  useIsBatchSupported: () => ({ data: mocks.supported, isLoading: mocks.isLoading })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [mocks.enabled] }));

const read = () =>
  renderHook(() => ({ pending: useBatchSupportPending(), batch: useShouldUseBatch() })).result.current;

describe('useBatchSupportPending', () => {
  beforeEach(() => Object.assign(mocks, { enabled: true, isLoading: true, supported: undefined }));

  it('is pending while the probe is out for a user who opted into batching', () => {
    expect(read()).toEqual({ pending: true, batch: false });
    Object.assign(mocks, { isLoading: false, supported: true });
    expect(read()).toEqual({ pending: false, batch: true });
  });

  it('settles on one call at a time once the probe answers no or fails', () => {
    Object.assign(mocks, { isLoading: false, supported: undefined });
    expect(read()).toEqual({ pending: false, batch: false });
  });

  it('never waits for a user who turned batching off', () => {
    mocks.enabled = false;
    expect(read()).toEqual({ pending: false, batch: false });
  });
});
