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
