export const SECONDS_PER_HOUR = 60 * 60;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * 24;
export const SECONDS_PER_YEAR = SECONDS_PER_DAY * 365;

// Decimal-place counts used as scale exponents for bigint math. WAD = 1e18,
// RAY = 1e27, RAD = 1e45, USDC = 1e6. See https://docs.makerdao.com/other-documentation/system-glossary.
export const WAD_PRECISION = 18;
export const RAY_PRECISION = 27;
export const RAD_PRECISION = 45;
export const USDC_PRECISION = 6;

// The scale factors themselves, for bigint math.
export const WAD = 10n ** BigInt(WAD_PRECISION);
export const RAY = 10n ** BigInt(RAY_PRECISION);
