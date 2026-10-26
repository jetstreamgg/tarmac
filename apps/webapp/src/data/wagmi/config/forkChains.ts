import { defineChain, type Chain } from 'viem';
import { base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { forkChainId } from '@/utils/chainId';
import { tenderlyForkRpcUrl } from './tenderlyForkRpc';

const FORK_L2S = [
  { chain: base, id: forkChainId.base, network: 'base' },
  { chain: arbitrum, id: forkChainId.arbitrum, network: 'arbitrum' },
  { chain: optimism, id: forkChainId.optimism, network: 'optimism' },
  { chain: unichain, id: forkChainId.unichain, network: 'unichain' }
];

const rpcName = import.meta.env?.VITE_TENDERLY_RPC_NAME;
// Same rule as USE_TESTNET_CONFIG (lib/constants, which this engine-layer module can't import).
const devConfig = import.meta.env?.VITE_TESTNET_CONFIG === 'true' || import.meta.env?.MODE === 'development';

/**
 * The Tenderly multichain fork L2s the dev build connects to: all four when
 * `VITE_TENDERLY_RPC_NAME` names the environment. Spreads the real chain so
 * multicall3 and the OP-stack formatters carry over. None outside the dev
 * config, and none in the mock wallet build, whose L2 forks keep their real ids.
 */
export const forkL2Chains: Chain[] =
  !rpcName || !devConfig || import.meta.env?.VITE_USE_MOCK_WALLET === 'true'
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
