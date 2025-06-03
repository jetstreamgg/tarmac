import { http } from 'viem';
import { createConfig, createStorage, noopStorage } from 'wagmi';
import { getTestTenderlyChains } from './testTenderlyChain';
import { mock } from 'wagmi/connectors';
import { TEST_WALLET_ADDRESSES } from '@/test/e2e/utils/testWallets';
import { optimism, unichain } from 'viem/chains';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain] =
  getTestTenderlyChains();

// Get worker index from environment variable or default to 0
const workerIndex = Number(import.meta.env.VITE_TEST_WORKER_INDEX || 0);

// Assert the array as a non-empty tuple type
const accounts = TEST_WALLET_ADDRESSES as [`0x${string}`, ...`0x${string}`[]];

export const mockWagmiConfig = createConfig({
  chains: [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain],
  connectors: [
    mock({
      accounts,
      features: {
        reconnect: true
      }
    })
  ],
  transports: {
    [tenderlyMainnet.id]: http(),
    [tenderlyBase.id]: http(),
    [tenderlyArbitrum.id]: http(),
    [optimism.id]: http(),
    [unichain.id]: http()
  },
  storage: createStorage({
    storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage,
    key: `wagmi-mock-${workerIndex}`
  })
});
