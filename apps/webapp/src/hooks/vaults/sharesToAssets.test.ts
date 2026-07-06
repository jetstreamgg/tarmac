import { describe, expect, it } from 'vitest';
import { sharesToAssets } from './sharesToAssets';

const E18 = 10n ** 18n;

describe('sharesToAssets', () => {
  it('returns 0n for zero shares', () => {
    expect(sharesToAssets(0n, E18)).toBe(0n);
  });

  it('converts 18-decimal shares at a 1:1 rate (Morpho)', () => {
    // 1 share (1e18) with convertToAssets(1e18) = 1e18 → 1e18 assets
    expect(sharesToAssets(E18, E18)).toBe(E18);
  });

  it('applies the exchange rate for 18-decimal shares', () => {
    // rate 1.05 → convertToAssets(1e18) = 1.05e18; 2 shares (2e18) → 2.1e18 assets
    const assetPerShareE18 = (105n * E18) / 100n;
    expect(sharesToAssets(2n * E18, assetPerShareE18)).toBe((210n * E18) / 100n);
  });

  it('converts 6-decimal shares (sUSDT) without overstating — regression for the 325B-USDT bug', () => {
    // 6-decimal vault at 1:1 → convertToAssets(1e18) = 1e18. 0.33 sUSDT = 330000 (1e6 scale).
    const assetPerShareE18 = E18;
    const shares = 330_000n;
    // Correct: 0.33 USDT in 6-decimal units = 330000.
    expect(sharesToAssets(shares, assetPerShareE18)).toBe(330_000n);
    // The old buggy formula divided by 10^6 (share decimals) → 3.3e17. Guard against regressing.
    expect(sharesToAssets(shares, assetPerShareE18)).not.toBe((shares * assetPerShareE18) / 1_000_000n);
  });
});
