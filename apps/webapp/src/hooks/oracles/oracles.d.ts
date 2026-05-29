import { ReadHook } from '../hooks';

export type OracleData = {
  price: bigint;
  decimals: number;
  age: number;
  symbol: string;
  formattedUsdPrice: string;
};

export type OracleHookResponse = ReadHook & {
  data?: OracleData;
};

export type OraclesHookResponse = ReadHook & {
  data?: OracleData[];
};
