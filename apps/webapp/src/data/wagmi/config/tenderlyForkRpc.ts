// Zero-import so vite.config.ts and the node scripts can share it.

/** The L2s of the Tenderly multichain dev environment, by the network label of their RPC host. */
export const TENDERLY_FORK_L2_NETWORKS = ['base', 'arbitrum', 'optimism', 'unichain'] as const;

/**
 * Public RPC of one chain of a named Tenderly multichain environment. Its chains
 * share the RPC name; only the network label in the host changes.
 */
export const tenderlyForkRpcUrl = (rpcName: string, network: string): string =>
  `https://virtual.${network}.eu.rpc.tenderly.co/${rpcName}`;
