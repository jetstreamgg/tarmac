import { describe, expect, it } from 'vitest';
import * as math from './math';
import { debtCeilingUtilization, roundDownLastTwelveDigits, roundUpLastTwelveDigits } from './math';
import { parseEther } from 'viem';

const ethAParams = {
  // This is the ETH-A 'duty' from 'jug' contract
  duty: BigInt('1000000000472114805215157978'),

  // ETH-A 'chop' from 'dog' contract
  chop: BigInt('1130000000000000000'),

  // DAI 'par' & ETH-A 'mat' from 'spot' contract
  par: BigInt('1000000000000000000000000000'),
  mat: BigInt('1450000000000000000000000000'),

  // ETH-A 'spot', 'rate' from 'vat' contract
  spot: BigInt('1153124137931034482758620689655'),
  rate: BigInt('1086194344171615624883224861')
};

// Randomly selected vault #29810
const testUrn = {
  ink: BigInt('170504224432949487863'),
  art: BigInt('169270852554661192394644')
};

describe('Risk parameter math functions using ETH-A risk parameters', () => {
  const { duty, chop, par, mat, spot, rate } = ethAParams;
  const { ink, art } = testUrn;

  it('Can calculate the annual stability fee from an ilks duty', () => {
    const expectedFee = BigInt('14999999567561817');

    const fee = math.annualStabilityFee(duty);
    expect(fee).eq(expectedFee);
  });

  it('Can calculate the liquidation penalty for an ilk', () => {
    const expectedPenalty = BigInt('130000000000000000');
    const penalty = math.liquidationPenalty(chop);

    expect(penalty).eq(expectedPenalty);
  });

  it('Can calculate the debt value of a vault', () => {
    const expectedDebtValue = BigInt('183861042677980461151043');
    const debtVal = math.debtValue(art, rate);

    expect(debtVal).eq(expectedDebtValue);
  });

  it('Can calculate the liquidation price for a vault', () => {
    const expectedPrice = BigInt('1563588895053512910785');

    const price = math.liquidationPrice(ink, math.debtValue(art, rate), mat);
    expect(price).eq(expectedPrice);
  });

  it('Can calculate the liquidation price for a vault when the collateral amount is 0', () => {
    const expectedPrice = BigInt('0');
    const collateralAmount = BigInt('0');

    const price = math.liquidationPrice(collateralAmount, math.debtValue(art, rate), mat);
    expect(price).eq(expectedPrice);
  });

  it('Can calculate the delayed collateral price', () => {
    const expected = BigInt('1672030000000000000000');
    const price = math.delayedPrice(par, spot, mat);
    expect(price).eq(expected);
  });

  it('Can calculate the collateral value of a vault', () => {
    const expectedValue = BigInt('285088178378624532191571');
    const value = math.collateralValue(ink, math.delayedPrice(par, spot, mat));

    expect(value).eq(expectedValue);
  });

  it('Can calculate the collateralization ratio between collateral value and debt value', () => {
    const expectedRatio = BigInt('1550600000000000000');
    const ratio = math.collateralizationRatio(
      math.collateralValue(ink, math.delayedPrice(par, spot, mat)),
      math.debtValue(art, rate)
    );

    expect(ratio).eq(expectedRatio);
  });

  it('Can calculate the collateralization ratio between if debt value is 0', () => {
    const debtValue = BigInt('0');
    const expectedRatio = BigInt('0');
    const ratio = math.collateralizationRatio(
      math.collateralValue(ink, math.delayedPrice(par, spot, mat)),
      debtValue
    );

    expect(ratio).eq(expectedRatio);
  });

  it('Collateralization ratio handles the case where debtValue value is extremely small compared to col value', () => {
    const expectedRatio = BigInt('0');

    const debtValue = 1n;
    const collateralValue = 285088178378624532191571n;

    const ratio = math.collateralizationRatio(collateralValue, debtValue);

    expect(ratio).eq(expectedRatio);
  });

  it('Can calculate the minimum collateral amount for a vault to be safe', () => {
    const expected = BigInt('159446009870081080285');
    const minSafeColAmt = math.minSafeCollateralAmount(
      math.debtValue(art, rate),
      mat,
      math.delayedPrice(par, spot, mat)
    );
    expect(minSafeColAmt).eq(expected);
  });

  it('Can calculate the max collateral amount to withdraw for a vault to remain safe', () => {
    const expected = BigInt('11058214562868407578');
    const minSafeColAmt = math.minSafeCollateralAmount(
      math.debtValue(art, rate),
      mat,
      math.delayedPrice(par, spot, mat)
    );
    const maxColAvailable = math.maxCollateralAvailable(ink, minSafeColAmt);
    expect(maxColAvailable).eq(expected);
  });

  it('Can calculate the max dai available to withdraw for a vault to remain safe', () => {
    const expected = BigInt('12751494134864043808661');
    const maxSafeDebt = math.daiAvailable(
      math.collateralValue(ink, math.delayedPrice(par, spot, mat)),
      math.debtValue(art, rate),
      mat
    );

    expect(maxSafeDebt).eq(expected);
  });

  it('Handles divide by zero errors gracefully in artValue', () => {
    const debtValue = BigInt('0');
    const rate = BigInt('0');
    const expected = BigInt('0');
    const result = math.artValue(debtValue, rate);
    expect(result).eq(expected);
  });

  it('Handles divide by zero errors gracefully in liquidationPrice', () => {
    const ink = BigInt('0');
    const debtValue = BigInt('0');
    const mat = BigInt('0');
    const expected = BigInt('0');
    const result = math.liquidationPrice(ink, debtValue, mat);
    expect(result).eq(expected);
  });

  it('Handles divide by zero errors gracefully in collateralizationRatio', () => {
    const collateralValue = BigInt('0');
    const debtValue = BigInt('0');
    const expected = BigInt('0');
    const result = math.collateralizationRatio(collateralValue, debtValue);
    expect(result).eq(expected);
  });

  it('Handles divide by zero errors gracefully in minSafeCollateralAmount', () => {
    const debtValue = BigInt('0');
    const mat = BigInt('0');
    const price = BigInt('0');
    const expected = BigInt('0');
    const result = math.minSafeCollateralAmount(debtValue, mat, price);
    expect(result).eq(expected);
  });

  it('Handles divide by zero errors gracefully in daiAvailable', () => {
    const collateralValue = BigInt('0');
    const debtValue = BigInt('0');
    const mat = BigInt('0');
    const expected = BigInt('0');
    const result = math.daiAvailable(collateralValue, debtValue, mat);
    expect(result).eq(expected);
  });
});

describe('DSR Calculations', () => {
  const pie = BigInt('996385765950179275');
  const chi = BigInt('1003732761911113484874347970');
  const dsr = BigInt('1000000000315522921573372069');

  it('Can calculate a DSR balance from pie and chi', () => {
    const balance = math.dsrBalance(pie, chi);
    const expected = BigInt('1000105036786093740');

    expect(balance).eq(expected);
  });

  it('Can calculate the annual DAI savings rate', () => {
    const rate = math.annualDaiSavingsRate(dsr);
    const expected = BigInt('10000000622198524');

    expect(rate).eq(expected);
  });

  it('Can estimate sUSDS received from a given amount of USDS', () => {
    const usdsAmount = 1000000000000000000n;
    const updatedChi = 1017732859782526592471921499n;
    const received = math.calculateSharesFromAssets(usdsAmount, updatedChi);

    expect(received).eq(982576115517862100n);
  });
});

describe('Rewards Calculations', () => {
  const supplyTokenPrice = 1000000000000000000n;
  const rewardsTokenPrice = 1000000000000000000n;

  const rewardRate = BigInt('1157407407407407'); // .01 token per second
  const totalSupplied = BigInt('1000000000000000000000'); // 1000 tokens supplied

  it('Can calculate the Rate', () => {
    const rewardsRateValue = math.tokenValue(rewardRate, rewardsTokenPrice);
    const totalSuppliedValue = math.tokenValue(totalSupplied, supplyTokenPrice);

    const rate = math.getRewardsRate(rewardsRateValue, totalSuppliedValue);
    const expected = BigInt('36499999999999987152');

    expect(rate).eq(expected);
  });
});

describe('Risk parameters specific to Seal Module', () => {
  const surplusBuffer = BigInt('50000000000000000000000000');
  const assetsOwned = BigInt('30000000000000000000000000');
  const elixirOwned = BigInt('160000000000000000000000000');
  const dsr = BigInt('300000000000000000');

  it('Can calculate the soft debt ceiling', () => {
    const expected = BigInt('133800000000000000000000000');

    const sdc = math.softDebtCeiling(surplusBuffer, assetsOwned, elixirOwned);

    expect(sdc).eq(expected);
  });

  it('Can calculate the stability fee for MKR vaults when debt is above soft debt ceiling', () => {
    const totalDebt = BigInt('188000000000000000000000000');
    const expected = BigInt('1200000000000000000');

    const stabilityFee = math.mkrVaultStabilityFee(
      dsr,
      totalDebt,
      math.softDebtCeiling(surplusBuffer, assetsOwned, elixirOwned)
    );

    expect(stabilityFee).eq(expected);
  });

  it('Can calculate the stability fee for MKR vaults when debt is below soft debt ceiling', () => {
    const totalDebt = BigInt('160000000000000000000000000');

    const stabilityFee = math.mkrVaultStabilityFee(
      dsr,
      totalDebt,
      math.softDebtCeiling(surplusBuffer, assetsOwned, elixirOwned)
    );

    // SF should equal DSR when the debt is below the debt ceiling
    expect(stabilityFee).eq(dsr);
  });
});

describe('Debt Ceiling Utilization', () => {
  it('should return 1 when debt ceiling is 0', () => {
    const debtCeiling = 0n;
    const totalDebt = parseEther('100');

    const result = debtCeilingUtilization(debtCeiling, totalDebt);
    expect(result).toBe(1);
  });

  it('should calculate utilization ratio correctly', () => {
    const debtCeiling = parseEther('1000');
    const totalDebt = parseEther('250');

    const result = debtCeilingUtilization(debtCeiling, totalDebt);
    expect(result).toBe(0.25);
  });

  it('should return 1 when debt exceeds ceiling', () => {
    const debtCeiling = parseEther('1000');
    const totalDebt = parseEther('1500');

    const result = debtCeilingUtilization(debtCeiling, totalDebt);
    expect(result).toBe(1);
  });

  it('should return 0 when there is no debt', () => {
    const debtCeiling = parseEther('1000');
    const totalDebt = 0n;

    const result = debtCeilingUtilization(debtCeiling, totalDebt);
    expect(result).toBe(0);
  });

  it('should handle very small utilization ratios', () => {
    const debtCeiling = parseEther('1000000');
    const totalDebt = parseEther('1');

    const result = debtCeilingUtilization(debtCeiling, totalDebt);
    expect(result).toBe(0.000001);
  });
});

it('Can convert decimal places between 18 (wad) and 6 (USDC)', () => {
  const usdcAmount = 6000000n;
  const wadAmount = 6000000000000000000n;

  const convertedUsdc = math.convertUSDCtoWad(usdcAmount);
  const convertedWad = math.convertWadtoUSDC(wadAmount);

  expect(convertedUsdc).toBe(wadAmount);
  expect(convertedWad).toBe(usdcAmount);
});

it('convertWadtoUSDC truncates instead of rounding to prevent insufficient-balance reverts', () => {
  const wadAmount = 1500000999999999999n;
  const result = math.convertWadtoUSDC(wadAmount);

  expect(result).toBe(1500000n);
});

// ... existing imports and tests ...

describe('USDC rounding functions', () => {
  describe('roundDownLastTwelveDigits', () => {
    it('should handle null and undefined values', () => {
      expect(roundDownLastTwelveDigits(null)).toBe(0n);
      expect(roundDownLastTwelveDigits(undefined)).toBe(0n);
    });

    it('should not modify small numbers', () => {
      expect(roundDownLastTwelveDigits(123n)).toBe(123n);
      expect(roundDownLastTwelveDigits(0n)).toBe(0n);
    });

    it('should zero out last 12 digits of large numbers', () => {
      // 1.5 WAD (1.5 * 10^18)
      const onePointFive = 1500000000000000000n;
      // Expected: 1.5 WAD rounded down to USDC precision (1.5 * 10^6 * 10^12)
      const expected = 1500000000000000000n;
      expect(roundDownLastTwelveDigits(onePointFive)).toBe(expected);

      // 1.555555555555555555 WAD
      const complex = 1555555555555555555n;
      // Expected: 1.555555000000000000 WAD
      const expectedComplex = 1555555000000000000n;
      expect(roundDownLastTwelveDigits(complex)).toBe(expectedComplex);
    });
  });

  describe('roundUpLastTwelveDigits', () => {
    it('should handle null and undefined values', () => {
      expect(roundUpLastTwelveDigits(null)).toBe(0n);
      expect(roundUpLastTwelveDigits(undefined)).toBe(0n);
    });

    it('should not modify small numbers', () => {
      expect(roundUpLastTwelveDigits(123n)).toBe(123n);
      expect(roundUpLastTwelveDigits(0n)).toBe(0n);
    });

    it('should round up last 12 digits of large numbers', () => {
      // 1.500000000000000000 WAD
      const exact = 1500000000000000000n;
      expect(roundUpLastTwelveDigits(exact)).toBe(exact);

      // 1.500000000000000001 WAD
      const slightlyOver = 1500000000000000001n;
      // Expected: 1.500001000000000000 WAD
      const expectedOver = 1500001000000000000n;
      expect(roundUpLastTwelveDigits(slightlyOver)).toBe(expectedOver);

      // 1.555555555555555555 WAD
      const complex = 1555555555555555555n;
      // Expected: 1.555556000000000000 WAD
      const expectedComplex = 1555556000000000000n;
      expect(roundUpLastTwelveDigits(complex)).toBe(expectedComplex);
    });
  });
});
