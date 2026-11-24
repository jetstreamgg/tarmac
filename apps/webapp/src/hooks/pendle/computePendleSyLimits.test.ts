import { describe, expect, it } from 'vitest';
import {
  computePendleSyLimits,
  maxPendleSupplyInput,
  type PendleSyLimitsInput
} from './computePendleSyLimits';

const E18 = 10n ** 18n;
const MAX_UINT256 = 2n ** 256n - 1n;

// The new SY as it sits on mainnet today: limiter off, no cap.
const OFF: PendleSyLimitsInput = {
  isRateLimited: false,
  availableBurn: 0n,
  aggregateAvailableBurn: 25_000_000n * E18,
  syPrice: 0n,
  burnQuota: 0n,
  supplyCap: MAX_UINT256,
  totalSupply: 447_530n * E18,
  exchangeRate: (11n * E18) / 10n // 1 share = 1.1 USDS
};

describe('computePendleSyLimits', () => {
  it('reports no limits while the limiter is off and the SY is uncapped', () => {
    expect(computePendleSyLimits(OFF)).toEqual({});
  });

  it('states the burn limit in PT at one asset per PT', () => {
    const limits = computePendleSyLimits({ ...OFF, isRateLimited: true, availableBurn: 1_000n * E18 });
    expect(limits.maxWithdrawPt).toBe(1_100n * E18);
  });

  it('reports zero once the meter is used up', () => {
    expect(computePendleSyLimits({ ...OFF, isRateLimited: true }).maxWithdrawPt).toBe(0n);
  });

  it("adds the wallet's burn quota on top of the meter", () => {
    const limits = computePendleSyLimits({
      ...OFF,
      isRateLimited: true,
      availableBurn: 1_000n * E18,
      burnQuota: 500n * E18
    });
    expect(limits.maxWithdrawPt).toBe(1_650n * E18);
  });

  it('applies the shared USD meter only to a priced SY', () => {
    const limited = { ...OFF, isRateLimited: true, availableBurn: 1_000n * E18 };
    // $220 left at $1.10 a share is 200 shares, under the token meter's 1,000.
    expect(
      computePendleSyLimits({
        ...limited,
        aggregateAvailableBurn: 220n * E18,
        syPrice: (11n * E18) / 10n
      }).maxWithdrawPt
    ).toBe(220n * E18);
    expect(
      computePendleSyLimits({ ...limited, aggregateAvailableBurn: 220n * E18, syPrice: 0n }).maxWithdrawPt
    ).toBe(1_100n * E18);
  });

  it('keeps the burn quota outside the shared meter too', () => {
    const limits = computePendleSyLimits({
      ...OFF,
      isRateLimited: true,
      availableBurn: 1_000n * E18,
      aggregateAvailableBurn: 0n,
      syPrice: E18,
      burnQuota: 100n * E18
    });
    expect(limits.maxWithdrawPt).toBe(110n * E18);
  });

  it('reports the room under a supply cap in shares and assets', () => {
    const limits = computePendleSyLimits({ ...OFF, supplyCap: 500_000n * E18 });
    expect(limits.maxSupply).toEqual({ shares: 52_470n * E18, assets: 57_717n * E18 });
    expect(limits.maxWithdrawPt).toBeUndefined();
  });

  it('reports no room at or over the cap', () => {
    expect(computePendleSyLimits({ ...OFF, supplyCap: OFF.totalSupply }).maxSupply).toEqual({
      shares: 0n,
      assets: 0n
    });
    expect(computePendleSyLimits({ ...OFF, supplyCap: 1n }).maxSupply).toEqual({ shares: 0n, assets: 0n });
  });
});

describe('maxPendleSupplyInput', () => {
  const limits = { maxSupply: { shares: 100n * E18, assets: 110n * E18 } };

  it('is undefined without a cap', () => {
    expect(
      maxPendleSupplyInput({}, { isVaultToken: false, decimals: 18, assetDecimals: 18 })
    ).toBeUndefined();
    expect(
      maxPendleSupplyInput(undefined, { isVaultToken: true, decimals: 18, assetDecimals: 18 })
    ).toBeUndefined();
  });

  it('caps the vault token in shares and other tokens in assets', () => {
    expect(maxPendleSupplyInput(limits, { isVaultToken: true, decimals: 18, assetDecimals: 18 })).toBe(
      100n * E18
    );
    expect(maxPendleSupplyInput(limits, { isVaultToken: false, decimals: 18, assetDecimals: 18 })).toBe(
      110n * E18
    );
  });

  it("scales the asset figure to the input token's decimals", () => {
    expect(maxPendleSupplyInput(limits, { isVaultToken: false, decimals: 6, assetDecimals: 18 })).toBe(
      110_000_000n
    );
  });
});
