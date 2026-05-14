import { formatUnits, parseUnits } from 'viem';

// For more information on the numerical units, see: https://github.com/makerdao/dss/blob/master/DEVELOPING.md#units

export const formatWad = (value?: bigint) => formatCustomDecimals(value, 18);
export const formatRay = (value?: bigint) => formatCustomDecimals(value, 27);
export const formatCustomDecimals = (value?: bigint, decimals?: number) =>
  value && decimals ? formatUnits(value, decimals) : '0';

export const parseWad = (value?: `${number}`) => (value ? parseUnits(value, 18) : 0n);
export const parseRay = (value?: `${number}`) => (value ? parseUnits(value, 27) : 0n);
