import { defineChain, type Chain } from 'viem';
import { base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { FORK_L2_NETWORKS, forkChainId, type ForkL2Network } from '@/utils/chainId';
import { tenderlyForkRpcUrl } from './tenderlyForkRpc';
import { USE_TESTNET_CONFIG } from './testnetConfig';

const REAL_L2: Record<ForkL2Network, Chain> = { base, arbitrum, optimism, unichain };

const FORK_L2S = FORK_L2_NETWORKS.map(network => ({
  chain: REAL_L2[network],
  id: forkChainId[network],
  network
}));

const rpcName = import.meta.env?.VITE_TENDERLY_RPC_NAME;

/**
 * The Tenderly multichain fork L2s the dev build connects to: all four when
 * `VITE_TENDERLY_RPC_NAME` names the environment. Spreads the real chain so
 * multicall3 and the OP-stack formatters carry over. None outside the dev
 * config, and none in the mock wallet build, whose L2 forks keep their real ids.
 */
export const forkL2Chains: Chain[] =
  !rpcName || !USE_TESTNET_CONFIG || import.meta.env?.VITE_USE_MOCK_WALLET === 'true'
    ? []
    : FORK_L2S.map(({ chain, id, network }) =>
        defineChain({
          ...chain,
          id,
          name: `Tenderly ${chain.name}`,
          rpcUrls: { default: { http: [tenderlyForkRpcUrl(rpcName, network)] } },
          blockExplorers: undefined
        })
      );

export const forkL2ChainIds: number[] = forkL2Chains.map(chain => chain.id);
