import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY, PENDLE_DEFAULT_REDEEM_SLIPPAGE } from '../lib/constants';
import { usePendleSlippage } from './usePendleSlippage';

describe('usePendleSlippage stored value', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('falls back to the default over a stored 0% (APP-533)', () => {
    localStorage.setItem(PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY, '0');
    const { result } = renderHook(() => usePendleSlippage('redeem'));

    expect(result.current.slippage).toBe(PENDLE_DEFAULT_REDEEM_SLIPPAGE);
  });

  it('keeps a stored positive tolerance', () => {
    localStorage.setItem(PENDLE_REDEEM_SLIPPAGE_STORAGE_KEY, '0.005');
    const { result } = renderHook(() => usePendleSlippage('redeem'));

    expect(result.current.slippage).toBe(0.005);
  });
});
