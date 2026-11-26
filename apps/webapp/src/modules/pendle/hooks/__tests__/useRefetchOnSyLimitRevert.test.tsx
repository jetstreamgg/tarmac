import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRefetchOnSyLimitRevert } from '../useRefetchOnSyLimitRevert';

const limitRevert = () => ({ revert: { reason: '0xbf881cef', kind: 'unknown' } });

describe('useRefetchOnSyLimitRevert', () => {
  it('re-reads the limits once per limit revert', () => {
    const refetch = vi.fn();
    const first = limitRevert();
    const { rerender } = renderHook(({ error }) => useRefetchOnSyLimitRevert(error, refetch), {
      initialProps: { error: first as unknown }
    });
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender({ error: first });
    expect(refetch).toHaveBeenCalledTimes(1);

    rerender({ error: limitRevert() });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('leaves the limits alone for any other failure', () => {
    const refetch = vi.fn();
    const { rerender } = renderHook(({ error }) => useRefetchOnSyLimitRevert(error, refetch), {
      initialProps: { error: null as unknown }
    });
    rerender({ error: new Error('User rejected the request.') });
    expect(refetch).not.toHaveBeenCalled();
  });
});
