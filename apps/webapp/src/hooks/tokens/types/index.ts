export type GeneratedAddressGroup = Record<number, string>;

export type TokenMapping = {
  [key: string]: Token;
};

export type Token = {
  address: { [key: number]: `0x${string}` };
  abi?: any;
  name: string;
  color: string;
  symbol: string;
  decimals: number | { [key: number]: number };
  isNative?: boolean;
  isWrappedNative?: boolean;
};

export type TokenForChain = Omit<Token, 'address'> & {
  address?: `0x${string}`;
};
