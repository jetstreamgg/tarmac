/**
 * Chainalysis Oracle contract ABI and addresses for sanctions screening.
 * @see https://developers.chainalysis.com/sanctions-screening/oracle/chainalysis-oracle/introduction
 */

export const chainalysisOracleAbi = [
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'isSanctioned',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Oracle uses the same address on most chains, except Base
export const chainalysisOracleAddress: Record<number, `0x${string}`> = {
  1: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Ethereum Mainnet
  137: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Polygon
  56: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // BNB Smart Chain
  43114: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Avalanche
  10: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Optimism
  42161: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Arbitrum
  250: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Fantom
  42220: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Celo
  81457: '0x40C57923924B5c5c5455c48D93317139ADDaC8fb', // Blast
  8453: '0x3A91A31cB3dC49b4db9Ce721F50a9D076c8D739B' // Base (different address)
};

// Default to Ethereum mainnet for chains without oracle support
export const DEFAULT_ORACLE_CHAIN_ID = 1;
