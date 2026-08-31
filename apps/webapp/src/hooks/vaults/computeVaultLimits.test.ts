import { describe, expect, it } from 'vitest';
import { computeVaultLimits } from './computeVaultLimits';

// Providers whose ERC-4626 limit reads are honest (everything that isn't Morpho).
const SKY = { provider: 'sky' } as const;

describe('computeVaultLimits — on-chain limits (Spark/Sky)', () => {
  it('clamps a deposit over the remaining cap to the remaining cap', () => {
    const { maxDepositInput, depositCapReached } = computeVaultLimits({
      ...SKY,
      assetBalance: 1000n,
      maxDeposit: 100n,
      userAssets: 0n,
      userShares: 0n,
      maxWithdraw: 0n
    });

    expect(maxDepositInput).toBe(100n);
    expect(depositCapReached).toBe(false);
  });

  it('flags depositCapReached and zeroes the input when there is no room left', () => {
    const { maxDepositInput, depositCapReached } = computeVaultLimits({
      ...SKY,
      assetBalance: 1000n,
      maxDeposit: 0n,
      userAssets: 0n,
      userShares: 0n,
      maxWithdraw: 0n
    });

    expect(maxDepositInput).toBe(0n);
    expect(depositCapReached).toBe(true);
  });

  it('clamps the withdraw input to maxWithdraw when liquidity-constrained', () => {
    const { maxWithdrawInput, isLiquidityConstrained } = computeVaultLimits({
      ...SKY,
      assetBalance: 0n,
      maxDeposit: 500n,
      userAssets: 500n,
      userShares: 500n,
      maxWithdraw: 200n
    });

    expect(maxWithdrawInput).toBe(200n);
    expect(isLiquidityConstrained).toBe(true);
  });

  it('leaves both inputs unconstrained when wallet, cap and liquidity all allow it', () => {
    const { maxDepositInput, maxWithdrawInput, depositCapReached } = computeVaultLimits({
      ...SKY,
      assetBalance: 1000n,
      maxDeposit: 10n ** 30n, // effectively uncapped
      userAssets: 300n,
      userShares: 300n,
      maxWithdraw: 300n
    });

    expect(maxDepositInput).toBe(1000n);
    expect(maxWithdrawInput).toBe(300n);
    expect(depositCapReached).toBe(false);
  });

  it('treats an unknown (undefined) cap as uncapped, never cap-reached', () => {
    const { maxDepositInput, depositCapReached } = computeVaultLimits({
      ...SKY,
      assetBalance: 750n,
      maxDeposit: undefined,
      userAssets: 0n,
      userShares: 0n,
      maxWithdraw: undefined
    });

    expect(maxDepositInput).toBe(750n);
    expect(depositCapReached).toBe(false);
  });

  it('returns zeroes for a wallet with no balance and a position with no shares', () => {
    const { maxDepositInput, maxWithdrawInput } = computeVaultLimits({
      ...SKY,
      assetBalance: 0n,
      maxDeposit: 100n,
      userAssets: 0n,
      userShares: 0n,
      maxWithdraw: 0n
    });

    expect(maxDepositInput).toBe(0n);
    expect(maxWithdrawInput).toBe(0n);
  });

  it('withdraws nothing when the user holds no shares even if a stale position lingers', () => {
    const { maxWithdrawInput } = computeVaultLimits({
      ...SKY,
      assetBalance: 0n,
      maxDeposit: 0n,
      userAssets: 123n, // stale read
      userShares: 0n,
      maxWithdraw: 123n
    });

    expect(maxWithdrawInput).toBe(0n);
  });

  it('caps a Max withdrawal at the redeemable shares', () => {
    const { redeemShares } = computeVaultLimits({
      ...SKY,
      userAssets: 500n,
      userShares: 500n,
      maxRedeem: 200n
    });

    expect(redeemShares).toBe(200n);
  });

  it('never reports the withdraw limit as unavailable — the cap is on-chain', () => {
    const { isLiquidityDataUnavailable } = computeVaultLimits({
      ...SKY,
      userAssets: 500n,
      userShares: 500n,
      maxWithdraw: 500n,
      availableLiquidity: undefined
    });

    expect(isLiquidityDataUnavailable).toBe(false);
  });

  it('defaults missing inputs to zero without throwing', () => {
    const { maxDepositInput, maxWithdrawInput, depositCapReached } = computeVaultLimits({ ...SKY });

    expect(maxDepositInput).toBe(0n);
    expect(maxWithdrawInput).toBe(0n);
    expect(depositCapReached).toBe(false);
  });
});

// APP-456 #7: Morpho V2 vaults answer maxDeposit/maxWithdraw/maxRedeem with 0n
// for every account while deposits and withdrawals are wide open. Honouring
// those reads showed a supplied position with nothing available to withdraw.
describe('computeVaultLimits — Morpho (stubbed ERC-4626 limits)', () => {
  const stubbedReads = { maxDeposit: 0n, maxWithdraw: 0n, maxRedeem: 0n };

  it('withdraws the full position despite a 0n maxWithdraw read', () => {
    const { maxWithdrawInput, isLiquidityConstrained } = computeVaultLimits({
      provider: 'morpho',
      ...stubbedReads,
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: 10_000n
    });

    expect(maxWithdrawInput).toBe(500n);
    expect(isLiquidityConstrained).toBe(false);
  });

  it('redeems the whole share balance on Max despite a 0n maxRedeem read', () => {
    const { redeemShares } = computeVaultLimits({
      provider: 'morpho',
      ...stubbedReads,
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: 10_000n
    });

    expect(redeemShares).toBe(500n);
  });

  it('deposits the full wallet balance despite a 0n maxDeposit read', () => {
    const { maxDepositInput, depositCapReached } = computeVaultLimits({
      provider: 'morpho',
      ...stubbedReads,
      assetBalance: 1000n
    });

    expect(maxDepositInput).toBe(1000n);
    expect(depositCapReached).toBe(false);
  });

  it('clamps the withdraw input to the market API liquidity', () => {
    const { maxWithdrawInput, isLiquidityConstrained } = computeVaultLimits({
      provider: 'morpho',
      ...stubbedReads,
      userAssets: 500n,
      userShares: 500n,
      availableLiquidity: 200n
    });

    expect(maxWithdrawInput).toBe(200n);
    expect(isLiquidityConstrained).toBe(true);
  });

  it('reports the withdraw cap as unknown while the liquidity read is in flight', () => {
    const { maxWithdrawInput, isLiquidityConstrained, isLiquidityDataUnavailable } = computeVaultLimits({
      provider: 'morpho',
      ...stubbedReads,
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
      provider: 'morpho',
      ...stubbedReads,
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
      provider: 'morpho',
      ...stubbedReads,
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
      provider: 'morpho',
      userAssets: POSITION,
      userShares: POSITION,
      availableLiquidity: POSITION
    });

    expect(isFullPositionWithdrawable).toBe(true);
    expect(isLiquidityConstrained).toBe(false);
  });

  it('any shortfall is a constraint — the comparison is exact', () => {
    const { isFullPositionWithdrawable, isLiquidityConstrained } = computeVaultLimits({
      provider: 'morpho',
      userAssets: POSITION,
      userShares: POSITION,
      availableLiquidity: POSITION - 1n
    });

    expect(isFullPositionWithdrawable).toBe(false);
    expect(isLiquidityConstrained).toBe(true);
  });

  it('an unknown withdraw cap (liquidity read in flight) is never fully withdrawable', () => {
    const { isFullPositionWithdrawable } = computeVaultLimits({
      provider: 'morpho',
      userAssets: POSITION,
      userShares: POSITION,
      liquidityKnown: false
    });

    expect(isFullPositionWithdrawable).toBe(false);
  });
});
