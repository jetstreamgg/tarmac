import { describe, expect, it } from 'vitest';
import { computeVaultLimits } from './computeVaultLimits';

describe('computeVaultLimits', () => {
  it('clamps a deposit over the remaining cap to the remaining cap', () => {
    const { maxDepositInput, depositCapReached } = computeVaultLimits({
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
    const { maxWithdrawInput } = computeVaultLimits({
      assetBalance: 0n,
      maxDeposit: 500n,
      userAssets: 500n,
      userShares: 500n,
      maxWithdraw: 200n
    });

    expect(maxWithdrawInput).toBe(200n);
  });

  it('leaves both inputs unconstrained when wallet, cap and liquidity all allow it', () => {
    const { maxDepositInput, maxWithdrawInput, depositCapReached } = computeVaultLimits({
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
      assetBalance: 0n,
      maxDeposit: 0n,
      userAssets: 123n, // stale read
      userShares: 0n,
      maxWithdraw: 123n
    });

    expect(maxWithdrawInput).toBe(0n);
  });

  it('defaults missing inputs to zero without throwing', () => {
    const { maxDepositInput, maxWithdrawInput, depositCapReached } = computeVaultLimits({});

    expect(maxDepositInput).toBe(0n);
    expect(maxWithdrawInput).toBe(0n);
    expect(depositCapReached).toBe(false);
  });
});
