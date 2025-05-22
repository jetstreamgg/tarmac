import { FixedNumber } from 'ethers';
import invariant from 'tiny-invariant';
import {
  RAD_FORMAT,
  RAD_PRECISION,
  RAY_FORMAT,
  RAY_PRECISION,
  SECONDS_PER_YEAR,
  USDC_FORMAT,
  USDC_PRECISION,
  WAD_FORMAT,
  WAD_PRECISION
} from './math.constants';
import { formatUnits, parseUnits } from 'viem';

// Maker glossary: https://docs.makerdao.com/other-documentation/system-glossary

export const MKR_TO_SKY_PRICE_RATIO = 24000n;

// This multiplies the base by the factor N times, used for doubling, tripling, etc, any number of times
const fixedMultiplySeries = (base: FixedNumber, factor: FixedNumber, count: FixedNumber) => {
  invariant(base.format === factor.format && factor.format === count.format);
  const oneFixed = FixedNumber.fromString('1').toFormat(base.format);

  while (!count.isZero() && !count.isNegative()) {
    base = base.mul(factor);
    count = count.sub(oneFixed);
  }

  return base;
};

// Vaults math
export const annualStabilityFee = (duty: bigint): bigint => {
  const dutyFixed = FixedNumber.fromValue(duty, RAY_PRECISION, RAY_FORMAT);
  // Unfortunately FixedNumber doesn't have a .pow() method, so we have to cast as a float and recast as a bigint
  const rate = dutyFixed.toUnsafeFloat() ** SECONDS_PER_YEAR * 1 - 1;
  const fee = FixedNumber.fromString(rate.toString(), WAD_PRECISION);
  return fee.value;
};

export const liquidationPenalty = (chop: bigint): bigint => {
  const chopFixed = FixedNumber.fromValue(chop, WAD_PRECISION);
  const penalty = chopFixed.sub(FixedNumber.fromValue(1));
  return penalty.value;
};

export const delayedPrice = (par: bigint, spot: bigint, mat: bigint): bigint => {
  const parFixed = FixedNumber.fromValue(par, RAY_PRECISION, RAY_FORMAT);
  const spotFixed = FixedNumber.fromValue(spot, RAY_PRECISION, RAY_FORMAT);
  const matFixed = FixedNumber.fromValue(mat, RAY_PRECISION, RAY_FORMAT);

  const price = spotFixed.mul(parFixed).mul(matFixed).round(WAD_PRECISION).toFormat(WAD_FORMAT);
  return price.value;
};

export const debtValue = (art: bigint, rate: bigint): bigint => {
  const artFixed = FixedNumber.fromValue(art, WAD_PRECISION, RAY_FORMAT);
  const rateFixed = FixedNumber.fromValue(rate, RAY_PRECISION, RAY_FORMAT);

  // Normalize ray to wad
  const debtVal = artFixed.mul(rateFixed).round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return debtVal.value;
};

export const artValue = (debtValue: bigint, rate: bigint): bigint => {
  if (rate === BigInt(0)) {
    return BigInt(0); // Return 0 if any of the inputs are zero to avoid division by zero
  }

  const debtValueFixed = FixedNumber.fromValue(debtValue, WAD_PRECISION, RAY_FORMAT);
  const rateFixed = FixedNumber.fromValue(rate, RAY_PRECISION, RAY_FORMAT);

  // Divide debtValue by rate to get art
  const artFixed = debtValueFixed.div(rateFixed);

  // Normalize ray to wad
  const art = artFixed.round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return art.value;
};

export const liquidationPrice = (ink: bigint, debtValue: bigint, mat: bigint): bigint => {
  if (ink === BigInt(0)) {
    return BigInt(0); // Return 0 if any of the inputs are zero to avoid division by zero
  }

  const matFixed = FixedNumber.fromValue(mat, RAY_PRECISION, RAY_FORMAT);
  const inkFixed = FixedNumber.fromValue(ink, WAD_PRECISION, RAY_FORMAT);
  const debtValueFixed = FixedNumber.fromValue(debtValue, WAD_PRECISION, RAY_FORMAT);

  // Calculate the liquidation price
  const priceRay = debtValueFixed.mul(matFixed).div(inkFixed);

  // Convert to wad format
  const priceWad = priceRay.round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return priceWad.value;
};

export const collateralValue = (ink: bigint, price: bigint): bigint => {
  const inkFixed = FixedNumber.fromValue(ink, WAD_PRECISION);
  const priceFixed = FixedNumber.fromValue(price, WAD_PRECISION);
  const colValue = inkFixed.mul(priceFixed);

  return colValue.value;
};

export const collateralizationRatio = (collateralValue: bigint, debtValue: bigint): bigint => {
  if (debtValue === BigInt(0)) {
    return BigInt(0); // Return 0 if debtValue is zero to avoid division by zero
  }
  // Overflow error can occur dividing a larged FixedNumber number by an extremely small one
  // but col ratio does not need to be precise more than a few digits, we round to 4 digits
  const colValueFixed = FixedNumber.fromValue(collateralValue, WAD_PRECISION).round(4);
  const debtValueFixed = FixedNumber.fromValue(debtValue, WAD_PRECISION).round(4);

  if (debtValueFixed.eq(FixedNumber.fromValue(0n))) {
    return BigInt(0); // Return 0 to avoid division by zero
  }

  const ratio = colValueFixed.div(debtValueFixed).round(4);
  return ratio.value;
};

export const minSafeCollateralAmount = (debtValue: bigint, mat: bigint, price: bigint): bigint => {
  if (price === BigInt(0)) {
    return BigInt(0); // Return 0 if any of the inputs are zero to avoid division by zero
  }

  const debtValueFixed = FixedNumber.fromValue(debtValue, WAD_PRECISION, RAY_FORMAT);
  const matFixed = FixedNumber.fromValue(mat, RAY_PRECISION, RAY_FORMAT);
  const priceFixed = FixedNumber.fromValue(price, WAD_PRECISION, RAY_FORMAT);

  // Normalize ray to wad
  const amt = debtValueFixed.mul(matFixed).div(priceFixed).round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return amt.value;
};

export const maxCollateralAvailable = (ink: bigint, minSafeCollateralAmount: bigint): bigint => {
  return ink - minSafeCollateralAmount;
};

export const daiAvailable = (collateralValue: bigint, debtValue: bigint, mat: bigint): bigint => {
  if (mat === BigInt(0)) {
    return BigInt(0); // Return 0 if mat is zero to avoid division by zero
  }

  const colValueFixed = FixedNumber.fromValue(collateralValue, WAD_PRECISION, RAY_FORMAT);
  const debtValueFixed = FixedNumber.fromValue(debtValue, WAD_PRECISION, RAY_FORMAT);
  const matFixed = FixedNumber.fromValue(mat, RAY_PRECISION, RAY_FORMAT);

  const maxSafeDebtValue = colValueFixed.div(matFixed);
  const dv = debtValueFixed.lt(maxSafeDebtValue)
    ? maxSafeDebtValue.sub(debtValueFixed)
    : FixedNumber.fromString('0');

  // Normalize ray to wad
  const daiAvail = dv.round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return daiAvail.value;
};

export const updatedChi = (dsr: bigint, time: number, chi: bigint): bigint => {
  const dsrFixed = FixedNumber.fromValue(dsr, RAY_PRECISION, RAY_FORMAT);
  const chiFixed = FixedNumber.fromValue(chi, RAY_PRECISION, RAY_FORMAT);
  // Unfortunately FixedNumber doesn't have a .pow() method, so we have to cast as a float and recast as a bigint
  const rate = dsrFixed.toUnsafeFloat() ** time;

  const poweredValue = FixedNumber.fromString(rate.toString(), WAD_PRECISION).toFormat(RAY_FORMAT);
  const updatedChi = poweredValue.mul(chiFixed);

  return updatedChi.value;
};

// DSR Math
// Works the same for total supply, "Pie" and user slice "pie"
export const dsrBalance = (pie: bigint, chi: bigint): bigint => {
  const pieFixed = FixedNumber.fromValue(pie, WAD_PRECISION, RAY_FORMAT);
  const chiFixed = FixedNumber.fromValue(chi, RAY_PRECISION, RAY_FORMAT);

  // Normalize ray to wad
  const balance = pieFixed.mul(chiFixed).round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return balance.value;
};

export const annualDaiSavingsRate = (dsr: bigint): bigint => {
  const dsrFixed = FixedNumber.fromValue(dsr, RAY_PRECISION, RAY_FORMAT);
  // Unfortunately FixedNumber doesn't have a .pow() method, so we have to cast as a float and recast as a bigint
  const rate = dsrFixed.toUnsafeFloat() ** SECONDS_PER_YEAR * 1 - 1;
  const fee = FixedNumber.fromString(rate.toString(), WAD_PRECISION);

  return fee.value;
};

// Rewards Math
// Returns a token amount multiplied by price to get value
export const tokenValue = (amount: bigint, price: bigint, precision = WAD_PRECISION): bigint => {
  const amt = FixedNumber.fromValue(amount, precision);
  const prc = FixedNumber.fromValue(price, precision);
  const val = amt.mul(prc);

  return val.value;
};

export const getRewardsRate = (rewardsRateValue: bigint, totalSuppliedValue: bigint): bigint => {
  const rewardsValuePerYear = rewardsRateValue * BigInt(SECONDS_PER_YEAR);
  const rate = calculateRewardsRate(rewardsValuePerYear, totalSuppliedValue);

  return rate;
};

// Both inputs to this function should be normalized by a common denominator, eg. DAI value
export const calculateRewardsRate = (yearlyRewardsValue: bigint, totalSuppliedValue: bigint): bigint => {
  if (totalSuppliedValue === BigInt(0)) {
    return BigInt(0); // Return 0 if any of the inputs are zero to avoid division by zero
  }

  const yrvFixed = FixedNumber.fromValue(yearlyRewardsValue, WAD_PRECISION);
  const tsvFixed = FixedNumber.fromValue(totalSuppliedValue, WAD_PRECISION);

  const rate = yrvFixed.div(tsvFixed);

  return rate.value;
};

// Calculate Rate
export const calculateSavingsRate = (rate: bigint): bigint => {
  const compoundingPeriods = BigInt(12); // Example compounding periods per year (monthly)

  const scaleFactor = BigInt(10) ** BigInt(WAD_PRECISION);

  const onePlusRatePerPeriod = (rate * scaleFactor) / compoundingPeriods + scaleFactor;
  let rateBn = onePlusRatePerPeriod;

  for (let i = 1; i < compoundingPeriods; i++) {
    rateBn = (rateBn * onePlusRatePerPeriod) / scaleFactor;
  }

  const calculatedRate = rateBn - scaleFactor;

  return calculatedRate;
};

// Seal Module-specific math

export const debtCeilingUtilization = (debtCeiling: bigint, totalDaiDebt: bigint): number => {
  if (debtCeiling === BigInt(0)) return 1;
  const fixedCeiling = FixedNumber.fromValue(debtCeiling, WAD_PRECISION);
  const fixedDebt = FixedNumber.fromValue(totalDaiDebt, WAD_PRECISION);
  const utilization = fixedDebt.div(fixedCeiling);
  const utilizationNumber = Number(formatUnits(utilization.value, 18));
  return Math.min(utilizationNumber, 1);
};

export const softDebtCeiling = (surplusBuffer: bigint, assetsOwned: bigint, elixirOwned: bigint): bigint => {
  const sbFixed = FixedNumber.fromValue(surplusBuffer, WAD_PRECISION);
  const assetsFixed = FixedNumber.fromValue(assetsOwned, WAD_PRECISION);
  const elixirFixed = FixedNumber.fromValue(elixirOwned, WAD_PRECISION);

  const sdc = sbFixed
    .add(assetsFixed.mul(FixedNumber.fromString('0.66')))
    .add(elixirFixed.mul(FixedNumber.fromString('0.4')));
  return sdc.value;
};

// Equal to DSR if the total SE debt is below the SE Soft Debt Ceiling, and increases exponentially, with the SF doubling every 20% that the Soft Debt Ceiling is exceeded
export const mkrVaultStabilityFee = (dsr: bigint, totalSEDebt: bigint, softDebtCeiling: bigint) => {
  if (totalSEDebt < softDebtCeiling) return dsr;
  const dsrFixed = FixedNumber.fromValue(dsr, WAD_PRECISION);
  const totalDebtFixed = FixedNumber.fromValue(totalSEDebt, WAD_PRECISION);
  const sdcFixed = FixedNumber.fromValue(softDebtCeiling, WAD_PRECISION);

  // Determine how much larger than the debt ceiling the total debt is
  const debtDelta = totalDebtFixed.sub(sdcFixed);

  // This was established by Rune, not sure if it will be hardcoded or updatable
  const stepPct = FixedNumber.fromString('.2');

  // Determine the number of steps to double the DSR
  const stepSize = sdcFixed.mul(stepPct);
  const steps = debtDelta.div(stepSize).floor();

  // Double the DSR for every step
  const stabilityFee = fixedMultiplySeries(dsrFixed, FixedNumber.fromString('2'), steps);
  return stabilityFee.value;
};

// Removes the decimal part of a wad value
export const removeDecimalPartOfWad = (wadValue: bigint) => {
  const formatted = formatUnits(wadValue, 18);
  return parseUnits(formatted.split('.')[0], 18);
};

export const calculateConversion = (originToken: { symbol: string }, amount: bigint) => {
  if (originToken.symbol === 'DAI' || originToken.symbol === 'USDS') {
    return amount;
  }
  if (originToken.symbol === 'MKR') {
    return amount * MKR_TO_SKY_PRICE_RATIO;
  }

  return amount / MKR_TO_SKY_PRICE_RATIO;
};

export const calculateMKRtoSKYPrice = (mkrPrice: bigint): bigint => {
  return mkrPrice / MKR_TO_SKY_PRICE_RATIO;
};

export const convertUSDCtoWad = (usdcAmount: bigint) => {
  const usdcFixed = FixedNumber.fromValue(usdcAmount, USDC_PRECISION, USDC_FORMAT);
  const usdcWad = usdcFixed.round(USDC_PRECISION).toFormat(WAD_FORMAT);

  return usdcWad.value;
};

export const convertWadtoUSDC = (wadAmount: bigint) => {
  const wadFixed = FixedNumber.fromValue(wadAmount, WAD_PRECISION);
  const usdcWad = wadFixed.round(USDC_PRECISION).toFormat(USDC_FORMAT);

  return usdcWad.value;
};

//zero out the last 12 digits (18 - 6)
//Used to avoid min amount being too high when dealing with USDC, while keeping it a wad
export const roundDownLastTwelveDigits = (value: bigint | undefined | null): bigint => {
  const numDigitsToZero = 18 - 6;
  if (!value) return 0n;
  const valueString = value.toString();
  if (valueString.length <= numDigitsToZero) return value;
  const zeroedString = valueString.slice(0, -numDigitsToZero) + '0'.repeat(numDigitsToZero);
  return BigInt(zeroedString);
};

//rounds up to the nearest 12 digits
export const roundUpLastTwelveDigits = (value: bigint | undefined | null): bigint => {
  if (!value) return 0n;
  const roundedDown = roundDownLastTwelveDigits(value);
  if (roundedDown === value) return value;
  return roundedDown + BigInt('1' + '0'.repeat(18 - 6));
};

export const calculateSharesFromAssets = (usdsAmount: bigint, chi: bigint) => {
  if (chi === BigInt(0)) {
    return BigInt(0); // Return 0 to avoid division by zero
  }
  const amtFixed = FixedNumber.fromValue(usdsAmount, WAD_PRECISION, RAY_FORMAT);
  const chiFixed = FixedNumber.fromValue(chi, RAY_PRECISION, RAY_FORMAT);

  const rec = amtFixed.div(chiFixed).round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return rec.value;
};

// This is the same as dsrBalance() but named for consistency with calculateSharesFromAssets()
export const calculateAssetsFromShares = (susdsAmount: bigint, chi: bigint) => {
  const amtFixed = FixedNumber.fromValue(susdsAmount, WAD_PRECISION, RAY_FORMAT);
  const chiFixed = FixedNumber.fromValue(chi, RAY_PRECISION, RAY_FORMAT);

  const rec = amtFixed.mul(chiFixed).round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return rec.value;
};

// Conversions
export const convertRadToWad = (radValue: bigint): bigint => {
  const radFixed = FixedNumber.fromValue(radValue, RAD_PRECISION, RAD_FORMAT);
  // Convert to WAD format (normalize from 27 to 18 decimal places)
  const wadFixed = radFixed.round(WAD_PRECISION).toFormat(WAD_FORMAT);

  return wadFixed.value;
};
