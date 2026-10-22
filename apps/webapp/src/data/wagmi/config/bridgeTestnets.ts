import { defineChain, type Chain } from 'viem';
import { arbitrum, base, optimism, unichain } from 'viem/chains';
import { l2TestnetChainId } from '@/utils/chainId';
import { tenderlyTestnetRpc } from './testTenderlyChain';

const L2_TESTNETS = [
  { chain: base, subdomain: 'base' },
  { chain: arbitrum, subdomain: 'arbitrum' },
  { chain: optimism, subdomain: 'optimism' },
  { chain: unichain, subdomain: 'unichain' }
];

/**
 * The bridge's Tenderly testnets of the L2s, for the dev config: each real
 * chain under its testnet id and RPC. No explorer, since the real one has
 * none of the testnet's transactions.
 */
export const bridgeTestnetChains: Chain[] = L2_TESTNETS.map(({ chain, subdomain }) =>
  defineChain({
    ...chain,
    id: l2TestnetChainId[chain.id],
    name: `Tenderly ${chain.name}`,
    rpcUrls: { default: { http: [tenderlyTestnetRpc(subdomain)] } },
    blockExplorers: undefined
  })
);
