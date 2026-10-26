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

// The L2s of the Tenderly multichain dev environment, under Tenderly's default
// virtual ids (replay-protected, unlike real ids). The Ethereum fork is `tenderly`.
export const forkChainId = {
  base: 9998453,
  arbitrum: 99942161,
  optimism: 99910,
  unichain: 999130
} as const;

const REAL_CHAIN_ID_BY_FORK: Record<number, number> = {
  [chainId.tenderly]: chainId.mainnet,
  [forkChainId.base]: chainId.base,
  [forkChainId.arbitrum]: chainId.arbitrum,
  [forkChainId.optimism]: chainId.optimism,
  [forkChainId.unichain]: chainId.unichain
};

const FORK_L2_BY_REAL: Record<number, number> = {
  [chainId.base]: forkChainId.base,
  [chainId.arbitrum]: forkChainId.arbitrum,
  [chainId.optimism]: forkChainId.optimism,
  [chainId.unichain]: forkChainId.unichain
};

/** The production chain a Tenderly fork stands in for; any other id comes back unchanged. */
export const realChainId = (id: number): number => REAL_CHAIN_ID_BY_FORK[id] ?? id;

/** Whether the id is one of the Tenderly forks (Ethereum or an L2). */
export const isForkChainId = (id: number): boolean => id in REAL_CHAIN_ID_BY_FORK;

/**
 * Copies each real-L2 entry of a chain-keyed map to its fork id, so the fork L2s
 * resolve the same addresses and settings. Entries already keyed by a fork id win.
 * Every fork id gets one in every build; which chains are live is CHAIN_WIDGET_MAP's call.
 */
export function withForkAliases<M extends Record<number, unknown>>(map: M): M {
  const aliased: Record<number, unknown> = { ...map };
  for (const [real, fork] of Object.entries(FORK_L2_BY_REAL)) {
    if (real in map && !(fork in map)) aliased[fork] = map[Number(real)];
  }
  return aliased as M;
}
