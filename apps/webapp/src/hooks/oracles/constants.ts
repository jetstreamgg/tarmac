import { OracleData } from './oracles';

// MOCKS
// TODO: Delete
export const oraclesMockData: Record<string, OracleData> = {
  eth: {
    price: 2476794224325000000000n,
    decimals: 18,
    age: 1707732036,
    symbol: 'ETH',
    formattedUsdPrice: '2476.79'
  },
  weth: {
    price: 2476794224325000000000n,
    decimals: 18,
    age: 1707732036,
    symbol: 'WETH',
    formattedUsdPrice: '2476.79'
  },
  dai: {
    price: 999864355781351453n,
    decimals: 18,
    age: 1707712368,
    symbol: 'DAI',
    formattedUsdPrice: '0.99'
  },
  usds: {
    price: 999864355781351453n,
    decimals: 18,
    age: 1707712368,
    symbol: 'USDS',
    formattedUsdPrice: '0.99'
  },
  mkr: {
    price: 2000031739170304932614n,
    decimals: 18,
    age: 1707712368,
    symbol: 'MKR',
    formattedUsdPrice: '2000.03'
  },
  sky: {
    price: 83333000000000000n,
    decimals: 18,
    age: 1707712368,
    symbol: 'SKY',
    formattedUsdPrice: '0.083'
  },
  usdt: {
    price: 989864n,
    decimals: 6,
    age: 1707712368,
    symbol: 'USDT',
    formattedUsdPrice: '0.99'
  },
  usdc: {
    price: 999864n,
    decimals: 6,
    age: 1707712368,
    symbol: 'USDC',
    formattedUsdPrice: '0.99'
  },
  sdai: {
    price: 1032700000334568572n,
    decimals: 18,
    age: 1707712368,
    symbol: 'sDAI',
    formattedUsdPrice: '1.03'
  },
  // TODO: update placeholder data with real data
  cron: {
    price: 232700000334568572n,
    decimals: 18,
    age: 1708712368,
    symbol: 'CRON',
    formattedUsdPrice: '0.23'
  }
};
