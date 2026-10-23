import { defineChain, type Chain } from 'viem';
import { base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { forkChainId } from '@/utils/chainId';

const FORK_L2S = [
  { chain: base, id: forkChainId.base, rpc: import.meta.env?.VITE_RPC_PROVIDER_TENDERLY_BASE },
  { chain: arbitrum, id: forkChainId.arbitrum, rpc: import.meta.env?.VITE_RPC_PROVIDER_TENDERLY_ARBITRUM },
  { chain: optimism, id: forkChainId.optimism, rpc: import.meta.env?.VITE_RPC_PROVIDER_TENDERLY_OPTIMISM },
  { chain: unichain, id: forkChainId.unichain, rpc: import.meta.env?.VITE_RPC_PROVIDER_TENDERLY_UNICHAIN }
];

/**
 * The Tenderly multichain fork L2s the dev build connects to: one per L2 whose
 * RPC env var is set. Spreads the real chain so multicall3 and the OP-stack
 * formatters carry over. None in the mock wallet build, whose L2 forks keep
 * their real ids.
 */
export const forkL2Chains: Chain[] =
  import.meta.env?.VITE_USE_MOCK_WALLET === 'true'
    ? []
    : FORK_L2S.filter(({ rpc }) => !!rpc).map(({ chain, id, rpc }) =>
        defineChain({
          ...chain,
          id,
          name: `Tenderly ${chain.name}`,
          rpcUrls: { default: { http: [rpc as string] } },
          blockExplorers: undefined
        })
      );

export const forkL2ChainIds: number[] = forkL2Chains.map(chain => chain.id);
