import { formatUnits, parseUnits } from 'viem';
import { RAD_PRECISION, RAY_PRECISION, SECONDS_PER_YEAR, USDC_PRECISION, WAD_PRECISION } from './math.constants';

// Maker glossary: https://docs.makerdao.com/other-documentation/system-glossary

export const MKR_TO_SKY_RATE = 24000n; // Immutable in contract

// Half-up rescale of a bigint `x` interpreted at `from` decimals to `to`
// decimals. Matches ethers v6 FixedNumber's `round(N).toFormat(...)` for
// non-negative values (the only kind that flows through this module): add
// 5*10^(delta-1) then truncate-divide by 10^delta.
const rescaleHalfUp = (x: bigint, from: number, to: number): bigint => {
  if (from <= to) return x * 10n ** BigInt(to - from);
  const delta = BigInt(from - to);
  const half = 5n * 10n ** (delta - 1n);
  return (x + half) / 10n ** delta;
};

// Convert a JS float (the result of `Math.pow`) into a bigint at `decimals`
// scale, mirroring ethers `FixedNumber.fromString(rate.toString(), 18)
// .toFormat({decimals})`. JS Number.toString uses exponential notation outside
// roughly [1e-6, 1e21); the callers here only produce values near 1, so plain
// decimal notation is what we expect. Throw loudly otherwise — silent fallback
// would mask precision bugs.
const floatToScaledBigInt = (n: number, decimals: number): bigint => {
  const s = n.toString();
  if (s.includes('e') || s.includes('E')) {
    throw new Error(`floatToScaledBigInt: exponential notation unsupported (got "${s}")`);
  }
  return parseUnits(s as `${number}`, decimals);
};

const WAD = 10n ** BigInt(WAD_PRECISION);
const RAY = 10n ** BigInt(RAY_PRECISION);

// Vaults math
export const annualStabilityFee = (duty: bigint): bigint => {
  const dutyFloat = Number(formatUnits(duty, RAY_PRECISION));
  // Matches the original `duty ** SECONDS_PER_YEAR * 1 - 1` (the `* 1` is a no-op).
  const rate = dutyFloat ** SECONDS_PER_YEAR - 1;
  return floatToScaledBigInt(rate, WAD_PRECISION);
};

export const liquidationPenalty = (chop: bigint): bigint => chop - WAD;

export const delayedPrice = (par: bigint, spot: bigint, mat: bigint): bigint => {
  // Three RAY values multiplied via ethers FixedNumber at fixed256x27 truncate
  // by 10^27 after each mul, then round-half-up to wad.
  const step1 = (spot * par) / RAY;
  const step2 = (step1 * mat) / RAY;
  return rescaleHalfUp(step2, RAY_PRECISION, WAD_PRECISION);
};

export const debtValue = (art: bigint, rate: bigint): bigint => {
  // art is wad, rate is ray; ethers promotes art to ray format (×10^9),
  // multiplies (truncating by 10^27), then round-half-up to wad.
  return rescaleHalfUp((art * rate) / WAD, RAY_PRECISION, WAD_PRECISION);
};

export const artValue = (debtValue: bigint, rate: bigint): bigint => {
  if (rate === 0n) return 0n;
  // ethers promotes debtValue to ray format (×10^9), divides (× 10^27 / rate),
  // then round-half-up to wad. Net intermediate value at ray scale:
  // (debtValue * 10^36) / rate.
  return rescaleHalfUp((debtValue * 10n ** 36n) / rate, RAY_PRECISION, WAD_PRECISION);
};

export const liquidationPrice = (ink: bigint, debtValue: bigint, mat: bigint): bigint => {
  if (ink === 0n) return 0n;
  // ethers path at fixed256x27:
  //   debtValueFixed.mul(matFixed) → (debtValue * mat) / 10^18
  //   .div(inkFixed)               → ((debtValue * mat) / 10^18) * 10^18 / ink
  // Then round-half-up to wad.
  const inner = (debtValue * mat) / WAD;
  const rayValue = (inner * WAD) / ink;
  return rescaleHalfUp(rayValue, RAY_PRECISION, WAD_PRECISION);
};

export const collateralValue = (ink: bigint, price: bigint): bigint => (ink * price) / WAD;

export const collateralizationRatio = (collateralValue: bigint, debtValue: bigint): bigint => {
  if (debtValue === 0n) return 0n;
  // Pre-round both operands to 4 decimal places at wad to avoid fixed-point
  // overflow when debt is extremely small compared to collateral. Matches the
  // original ethers chain: round(4) on each input, div, round(4).
  const ROUND4_HALF = 5n * 10n ** 13n;
  const ROUND4_TENS = 10n ** 14n;
  const round4 = (v: bigint) => ((v + ROUND4_HALF) / ROUND4_TENS) * ROUND4_TENS;

  const colRounded = round4(collateralValue);
  const debtRounded = round4(debtValue);
  if (debtRounded === 0n) return 0n;

  const ratio = (colRounded * WAD) / debtRounded;
  return round4(ratio);
};

export const minSafeCollateralAmount = (debtValue: bigint, mat: bigint, price: bigint): bigint => {
  if (price === 0n) return 0n;
  // Same shape as liquidationPrice but with `price` (wad) in the denominator.
  const inner = (debtValue * mat) / WAD;
  const rayValue = (inner * WAD) / price;
  return rescaleHalfUp(rayValue, RAY_PRECISION, WAD_PRECISION);
};

export const maxCollateralAvailable = (ink: bigint, minSafeCollateralAmount: bigint): bigint => {
  return ink - minSafeCollateralAmount;
};

export const daiAvailable = (collateralValue: bigint, debtValue: bigint, mat: bigint): bigint => {
  if (mat === 0n) return 0n;
  // At fixed256x27: colValue (wad → ×10^9) divided by mat (ray) = colValue*10^36/mat.
  // Compare against debtValue promoted to ray scale (debtValue*10^9).
  const maxSafeDebtRay = (collateralValue * 10n ** 36n) / mat;
  const debtRay = debtValue * 10n ** 9n;
  if (debtRay >= maxSafeDebtRay) return 0n;
  return rescaleHalfUp(maxSafeDebtRay - debtRay, RAY_PRECISION, WAD_PRECISION);
};

export const updatedChi = (dsr: bigint, time: number, chi: bigint): bigint => {
  // ethers FixedNumber lacks .pow(), so the original casts dsr to float, raises
  // to `time`, then re-imports the float string. We mirror that path: any
  // change here silently shifts the dsr accrual curve.
  const dsrFloat = Number(formatUnits(dsr, RAY_PRECISION));
  const rate = dsrFloat ** time;
  // ethers does fromString(rate.toString(), 18).toFormat(RAY). For a plain
  // decimal float string with ≤18 fractional digits, parseUnits at RAY scale
  // is identical (pad-with-zeros on both sides).
  const poweredRay = floatToScaledBigInt(rate, RAY_PRECISION);
  // .mul at fixed256x27: (poweredRay * chi) / 10^27.
  return (poweredRay * chi) / RAY;
};

// DSR Math
// Works the same for total supply, "Pie" and user slice "pie"
export const dsrBalance = (pie: bigint, chi: bigint): bigint => {
  return rescaleHalfUp((pie * chi) / WAD, RAY_PRECISION, WAD_PRECISION);
};

export const annualDaiSavingsRate = (dsr: bigint): bigint => {
  const dsrFloat = Number(formatUnits(dsr, RAY_PRECISION));
  const rate = dsrFloat ** SECONDS_PER_YEAR - 1;
  return floatToScaledBigInt(rate, WAD_PRECISION);
};

// Rewards Math
// Returns a token amount multiplied by price to get value
export const tokenValue = (amount: bigint, price: bigint, precision = WAD_PRECISION): bigint => {
  return (amount * price) / 10n ** BigInt(precision);
};

export const getRewardsRate = (rewardsRateValue: bigint, totalSuppliedValue: bigint): bigint => {
  const rewardsValuePerYear = rewardsRateValue * BigInt(SECONDS_PER_YEAR);
  return calculateRewardsRate(rewardsValuePerYear, totalSuppliedValue);
};

// Both inputs to this function should be normalized by a common denominator, eg. DAI value
export const calculateRewardsRate = (yearlyRewardsValue: bigint, totalSuppliedValue: bigint): bigint => {
  if (totalSuppliedValue === 0n) return 0n;
  return (yearlyRewardsValue * WAD) / totalSuppliedValue;
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
  if (debtCeiling === 0n) return 1;
  const utilizationWad = (totalDaiDebt * WAD) / debtCeiling;
  const utilizationNumber = Number(formatUnits(utilizationWad, WAD_PRECISION));
  return Math.min(utilizationNumber, 1);
};

// 0.66 and 0.4 at wad — pre-encoded to avoid float→string→bigint round-trips.
const POINT_SIX_SIX_WAD = 660000000000000000n;
const POINT_FOUR_WAD = 400000000000000000n;

export const softDebtCeiling = (surplusBuffer: bigint, assetsOwned: bigint, elixirOwned: bigint): bigint => {
  const assetsPart = (assetsOwned * POINT_SIX_SIX_WAD) / WAD;
  const elixirPart = (elixirOwned * POINT_FOUR_WAD) / WAD;
  return surplusBuffer + assetsPart + elixirPart;
};

// Equal to DSR if the total SE debt is below the SE Soft Debt Ceiling, and increases exponentially, with the SF doubling every 20% that the Soft Debt Ceiling is exceeded
export const mkrVaultStabilityFee = (dsr: bigint, totalSEDebt: bigint, softDebtCeiling: bigint): bigint => {
  if (totalSEDebt < softDebtCeiling) return dsr;

  const debtDelta = totalSEDebt - softDebtCeiling;
  // 20% of softDebtCeiling. Bigint floor div by 5 is identical to ethers's
  // (sdc * 2*10^17) / 10^18 path for non-negative inputs.
  const stepSize = softDebtCeiling / 5n;
  // The ethers code does .div().floor() at fixed128x18, which collapses to
  // integer floor division for positive inputs.
  const steps = stepSize === 0n ? 0n : debtDelta / stepSize;

  let stabilityFee = dsr;
  for (let i = 0n; i < steps; i++) {
    stabilityFee = stabilityFee * 2n;
  }
  return stabilityFee;
};

// Removes the decimal part of a wad value
export const removeDecimalPartOfWad = (wadValue: bigint) => {
  const formatted = formatUnits(wadValue, 18);
  return parseUnits(formatted.split('.')[0], 18);
};

export const calculateConversion = (
  originToken: { symbol: string },
  amount: bigint,
  fee: bigint // Required fee parameter (WAD scaled, pass 0n if no fee)
): bigint => {
  if (originToken.symbol === 'DAI' || originToken.symbol === 'USDS') {
    return amount;
  }

  if (originToken.symbol === 'MKR') {
    const skyGross = amount * MKR_TO_SKY_RATE;
    if (fee > 0n) {
      const skyFee = (skyGross * fee) / parseUnits('1', 18);
      return skyGross - skyFee; // Return net amount after fee
    }
    return skyGross;
  }

  // SKY to MKR (no fee on reverse)
  return amount / MKR_TO_SKY_RATE;
};

export const calculateMKRtoSKYPrice = (mkrPrice: bigint, fee: bigint): bigint => {
  const skyPrice = mkrPrice / MKR_TO_SKY_RATE;
  if (fee > 0n) {
    // Adjust price for fee
    const adjustment = parseUnits('1', 18) - fee;
    return (skyPrice * adjustment) / parseUnits('1', 18);
  }
  return skyPrice;
};

export const calculateUpgradePenalty = (fee: bigint | undefined): string => {
  if (!fee || fee === 0n) return '0';

  // Convert WAD to percentage (fee is in 1e18 scale)
  const percentage = (fee * 10000n) / parseUnits('1', 18);
  const intPart = percentage / 100n;
  const fracPart = percentage % 100n;

  if (fracPart === 0n) {
    return intPart.toString();
  }

  const fracStr = fracPart.toString().padStart(2, '0');
  return fracStr.endsWith('0') ? `${intPart}.${fracStr[0]}` : `${intPart}.${fracStr}`;
};

export const calculateEffectiveSkyRate = (fee: bigint | undefined): string => {
  // Base rate is 1 MKR = 24,000 SKY
  const baseRate = MKR_TO_SKY_RATE;

  if (!fee || fee === 0n) {
    return baseRate.toLocaleString();
  }

  // Calculate effective rate after fee (fee is WAD scaled, 1e18 = 100%)
  const oneWad = parseUnits('1', 18);
  const effectiveRate = (baseRate * (oneWad - fee)) / oneWad;

  return effectiveRate.toLocaleString();
};

export const convertUSDCtoWad = (usdcAmount: bigint): bigint => {
  // ethers path: fromValue(usdcAmount, 6, USDC_FORMAT).round(6).toFormat(WAD_FORMAT).
  // round(6) is a no-op at fixed256x6, toFormat just pads to 18 decimals.
  return usdcAmount * 10n ** BigInt(WAD_PRECISION - USDC_PRECISION);
};

export const convertWadtoUSDC = (wadAmount: bigint): bigint => {
  // Truncate (floor) instead of rounding to avoid producing a USDC amount
  // that, when converted back to WAD by the PSM contract, exceeds the
  // original WAD balance (causes "Usds/insufficient-balance" on max-amount conversions).
  const precisionDiff = BigInt(10) ** BigInt(WAD_PRECISION - USDC_PRECISION);
  return wadAmount / precisionDiff;
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

export const calculateSharesFromAssets = (usdsAmount: bigint, chi: bigint): bigint => {
  if (chi === 0n) return 0n;
  // At fixed256x27: amt (wad ×10^9) / chi (ray) = (usdsAmount * 10^36) / chi.
  return rescaleHalfUp((usdsAmount * 10n ** 36n) / chi, RAY_PRECISION, WAD_PRECISION);
};

// This is the same as dsrBalance() but named for consistency with calculateSharesFromAssets()
export const calculateAssetsFromShares = (susdsAmount: bigint, chi: bigint): bigint => {
  return rescaleHalfUp((susdsAmount * chi) / WAD, RAY_PRECISION, WAD_PRECISION);
};

// Conversions
/** Resolve token decimals which can be a plain number or a chain-keyed object */
export function resolveDecimals(decimals: number | { [key: number]: number }, chainId: number): number {
  return typeof decimals === 'number' ? decimals : decimals[chainId];
}

/** Scale an amount from its native decimals to a target base decimals (defaults to 18) */
export function scaleToBaseDecimals(amount: bigint, tokenDecimals: number, baseDecimals = 18): bigint {
  if (tokenDecimals === baseDecimals) return amount;
  if (tokenDecimals < baseDecimals) {
    return amount * 10n ** BigInt(baseDecimals - tokenDecimals);
  }
  return amount / 10n ** BigInt(tokenDecimals - baseDecimals);
}

// Conversions
export const convertRadToWad = (radValue: bigint): bigint => {
  // Half-up rescale dropping the trailing 27 rad digits.
  return rescaleHalfUp(radValue, RAD_PRECISION, WAD_PRECISION);
};
