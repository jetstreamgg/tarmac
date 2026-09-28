import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTokenImage } from './useTokenImage';

const imageFor = (symbol: string) => renderHook(() => useTokenImage(symbol)).result.current;

describe('useTokenImage', () => {
  it('resolves a plain symbol to its lowercase icon', () => {
    expect(imageFor('USDS')).toBe('/tokens/usds.svg');
  });

  it('returns undefined for an empty symbol', () => {
    expect(imageFor('')).toBeUndefined();
  });

  it('resolves a dated Pendle PT symbol to the undated market icon', () => {
    // Morpho's market data returns PT collateral with its maturity attached.
    expect(imageFor('PT-sUSDS-26NOV2026')).toBe('/tokens/pt-susds.svg');
    expect(imageFor('PT-sUSDS-4JUN2026')).toBe('/tokens/pt-susds.svg');
  });

  it('leaves a PT symbol without a maturity suffix alone', () => {
    expect(imageFor('PT-sUSDS')).toBe('/tokens/pt-susds.svg');
  });

  it('only strips a suffix that looks like a maturity date', () => {
    expect(imageFor('PT-sUSDS-FOO')).toBe('/tokens/pt-susds-foo.svg');
  });
});
