import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const CHAIN_ID = 1;

const capabilities = vi.hoisted(() => ({
  data: undefined as Record<number, Record<string, unknown>> | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: () => {}
}));

vi.mock('wagmi', () => ({
  useChainId: () => CHAIN_ID,
  useCapabilities: () => capabilities
}));

import { useIsBatchSupported } from './useIsBatchSupported';

const render = (chainCapabilities: Record<string, unknown>) => {
  capabilities.data = { [CHAIN_ID]: chainCapabilities };
  return renderHook(() => useIsBatchSupported()).result.current.data;
};

afterEach(cleanup);

describe('useIsBatchSupported', () => {
  it('bundles when `atomic` is supported or ready', () => {
    expect(render({ atomic: { status: 'supported' } })).toBe(true);
    expect(render({ atomic: { status: 'ready' } })).toBe(true);
  });

  it('lets `atomic: unsupported` override a legacy `atomicBatch: true` (Ambire on an EOA, APP-637)', () => {
    expect(render({ atomicBatch: { supported: true }, atomic: { status: 'unsupported' } })).toBe(false);
  });

  it('keeps bundling for a wallet that reports both as supported (Safe)', () => {
    expect(render({ atomicBatch: { supported: true }, atomic: { status: 'supported' } })).toBe(true);
  });

  it('falls back to `atomicBatch` when the wallet does not report `atomic`', () => {
    expect(render({ atomicBatch: { supported: true } })).toBe(true);
    expect(render({ atomicBatch: { supported: false } })).toBe(false);
  });
});
