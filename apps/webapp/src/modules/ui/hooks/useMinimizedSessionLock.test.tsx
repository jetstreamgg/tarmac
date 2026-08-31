import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const ctx = vi.hoisted(() => ({
  isMinimized: false,
  activeSessionId: null as string | null,
  restore: vi.fn()
}));
vi.mock('@/modules/ui/context/TransactionContext', () => ({ useTransaction: () => ctx }));

import { useMinimizedSessionLock } from './useMinimizedSessionLock';

describe('useMinimizedSessionLock', () => {
  it('locks only while its own session is minimized', () => {
    const { result, rerender } = renderHook(() => useMinimizedSessionLock('mine'));
    expect(result.current.locked).toBe(false);

    ctx.activeSessionId = 'mine';
    rerender();
    expect(result.current.locked).toBe(false); // open, not minimized — the overlay covers the page

    ctx.isMinimized = true;
    rerender();
    expect(result.current.locked).toBe(true);
    expect(result.current.restore).toBe(ctx.restore);

    ctx.activeSessionId = 'another';
    rerender();
    expect(result.current.locked).toBe(false);
  });
});
