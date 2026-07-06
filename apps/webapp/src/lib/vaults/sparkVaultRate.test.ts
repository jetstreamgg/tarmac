import { describe, expect, it } from 'vitest';
import { resolveSparkVaultRate } from './sparkVaultRate';

describe('resolveSparkVaultRate', () => {
  it('prefers the API rate when present (API is the source of truth)', () => {
    expect(resolveSparkVaultRate({ apiFormattedRate: '3.65%', onChainFormattedRate: '3.10%' })).toBe('3.65%');
  });

  it('falls back to the on-chain vsr when the API rate is absent', () => {
    expect(resolveSparkVaultRate({ apiFormattedRate: undefined, onChainFormattedRate: '3.10%' })).toBe(
      '3.10%'
    );
  });

  it('treats a genuinely-zero API rate as present and renders 0% (does NOT fall back)', () => {
    // The normalizer surfaces a dormant rate as the *present* string "0.00%";
    // `??` must keep it, distinct from a missing rate that would fall through.
    expect(resolveSparkVaultRate({ apiFormattedRate: '0.00%', onChainFormattedRate: '5.00%' })).toBe('0.00%');
  });

  it('uses on-chain when only on-chain is a genuine zero', () => {
    expect(resolveSparkVaultRate({ apiFormattedRate: undefined, onChainFormattedRate: '0.00%' })).toBe(
      '0.00%'
    );
  });

  it('returns undefined when neither source has a rate', () => {
    expect(
      resolveSparkVaultRate({ apiFormattedRate: undefined, onChainFormattedRate: undefined })
    ).toBeUndefined();
  });
});
