import { describe, expect, it } from 'vitest';
import { isLiquidityExhausted, withdrawalsUnavailableFor } from './withdrawalsUnavailable';

describe('isLiquidityExhausted', () => {
  it('warns at zero liquidity', () => {
    expect(isLiquidityExhausted(0n, 1_000n)).toBe(true);
  });

  it('warns below 0.5% of deposits', () => {
    expect(isLiquidityExhausted(4n, 1_000n)).toBe(true);
  });

  it('does not warn at or above 0.5% of deposits', () => {
    expect(isLiquidityExhausted(5n, 1_000n)).toBe(false);
    expect(isLiquidityExhausted(500n, 1_000n)).toBe(false);
  });

  it('never warns on unknown or empty data', () => {
    expect(isLiquidityExhausted(undefined, 1_000n)).toBe(false);
    expect(isLiquidityExhausted(0n, undefined)).toBe(false);
    expect(isLiquidityExhausted(0n, 0n)).toBe(false);
  });
});

describe('withdrawalsUnavailableFor', () => {
  it('warns only stUSDS and the Risk Capital vaults', () => {
    expect(withdrawalsUnavailableFor('stusds', 0n, 1_000n)).toBe(true);
    expect(withdrawalsUnavailableFor('vault-risk-capital', 0n, 1_000n)).toBe(true);
    expect(withdrawalsUnavailableFor('vault-flagship', 0n, 1_000n)).toBe(false);
    expect(withdrawalsUnavailableFor('vault-usdt-savings', 0n, 1_000n)).toBe(false);
  });
});
