export const chainId = {
  // The two family anchors carry literal types so familyMainnetId's result
  // satisfies call sites typed against the generated `1 | 314310` unions.
  mainnet: 1 as const,
  tenderly: 314310 as const,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  unichain: 130
};

/**
 * The bridge's Tenderly testnets of the L2s, keyed by the real chain each one
 * forks. They carry their own ids so the dev config can hold them beside the
 * real networks; Ethereum's testnet is the Tenderly fork above.
 */
export const l2TestnetChainId: Record<number, number> = {
  [chainId.base]: 9998453,
  [chainId.arbitrum]: 99942161,
  [chainId.optimism]: 99910,
  [chainId.unichain]: 999130
};
