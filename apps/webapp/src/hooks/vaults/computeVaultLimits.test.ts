import { describe, expect, it } from 'vitest';
import { computeVaultLimits } from './computeVaultLimits';

describe('computeVaultLimits', () => {
  it('withdraws the full position when liquidity covers it', () => {
    const { maxWithdrawInput, isLiquidityConstrained } = computeVaultLimits({
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: 10_000n
    });

    expect(maxWithdrawInput).toBe(500n);
    expect(isLiquidityConstrained).toBe(false);
  });

  it('redeems the whole share balance on Max', () => {
    const { redeemShares } = computeVaultLimits({
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: 10_000n
    });

    expect(redeemShares).toBe(500n);
  });

  it('deposits the full wallet balance (no cap)', () => {
    const { maxDepositInput, depositCapReached } = computeVaultLimits({
      assetBalance: 1000n
    });

    expect(maxDepositInput).toBe(1000n);
    expect(depositCapReached).toBe(false);
  });

  it('clamps the withdraw input to the market API liquidity', () => {
    const { maxWithdrawInput, isLiquidityConstrained } = computeVaultLimits({
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: 200n
    });

    expect(maxWithdrawInput).toBe(200n);
    expect(isLiquidityConstrained).toBe(true);
  });

  it('reports the withdraw cap as unknown while the liquidity read is in flight', () => {
    const { maxWithdrawInput, isLiquidityConstrained, isLiquidityDataUnavailable } = computeVaultLimits({
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: undefined,
      liquidityKnown: false
    });

    expect(maxWithdrawInput).toBeUndefined();
    expect(isLiquidityConstrained).toBe(false);
    expect(isLiquidityDataUnavailable).toBe(false);
  });

  it('falls back to the full position when the liquidity read settles empty', () => {
    const { maxWithdrawInput, isLiquidityDataUnavailable } = computeVaultLimits({
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: undefined,
      liquidityKnown: true
    });

    // The contract still enforces the truth on submit.
    expect(maxWithdrawInput).toBe(500n);
    expect(isLiquidityDataUnavailable).toBe(true);
  });

  it('still withdraws nothing when the user holds no shares', () => {
    const { maxWithdrawInput, redeemShares } = computeVaultLimits({
      userAssets: 0n,
      userShares: 0n,
      availableLiquidity: 10_000n
    });

    expect(maxWithdrawInput).toBe(0n);
    expect(redeemShares).toBe(0n);
  });
});

describe('computeVaultLimits — full-position withdrawability', () => {
  const POSITION = 1_000n * 10n ** 18n;

  it('flags the position fully withdrawable when liquidity covers it', () => {
    const { isFullPositionWithdrawable, isLiquidityConstrained } = computeVaultLimits({
      userAssets: POSITION,
      userShares: POSITION,
      availableLiquidity: POSITION
    });

    expect(isFullPositionWithdrawable).toBe(true);
    expect(isLiquidityConstrained).toBe(false);
  });

  it('any shortfall is a constraint — the comparison is exact', () => {
    const { isFullPositionWithdrawable, isLiquidityConstrained } = computeVaultLimits({
      userAssets: POSITION,
      userShares: POSITION,
      availableLiquidity: POSITION - 1n
    });

    expect(isFullPositionWithdrawable).toBe(false);
    expect(isLiquidityConstrained).toBe(true);
  });

  it('an unknown withdraw cap (liquidity read in flight) is never fully withdrawable', () => {
    const { isFullPositionWithdrawable } = computeVaultLimits({
      userAssets: POSITION,
      userShares: POSITION,
      liquidityKnown: false
    });

    expect(isFullPositionWithdrawable).toBe(false);
  });
});
