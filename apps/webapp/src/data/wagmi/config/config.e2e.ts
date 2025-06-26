import { http, WalletRpcSchema, EIP1193Parameters } from 'viem';
import { createConfig, createConnector, createStorage, noopStorage } from 'wagmi';
import {
  getTestTenderlyChains,
  TENDERLY_ARBITRUM_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_CHAIN_ID
} from './testTenderlyChain';
import { mock, MockParameters } from 'wagmi/connectors';
import { TEST_WALLET_ADDRESSES } from '@/test/e2e/utils/testWallets';
import { optimism, unichain } from 'viem/chains';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain] =
  getTestTenderlyChains();

function extendedMock(params: MockParameters) {
  return createConnector(config => {
    const base = mock(params)(config);

    return {
      ...base,
      async getProvider({ chainId } = {}) {
        const provider = await base.getProvider({ chainId });

        // Create a proxy to intercept requests
        return new Proxy(provider, {
          get(target, prop) {
            if (prop === 'request') {
              return async (args: EIP1193Parameters<WalletRpcSchema>) => {
                // Handle wallet_getCapabilities method
                if (args.method === 'wallet_getCapabilities') {
                  return {
                    // Add capabilities for different chains
                    [TENDERLY_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [TENDERLY_BASE_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [TENDERLY_ARBITRUM_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [optimism.id]: { atomic: { status: 'supported' } },
                    [unichain.id]: { atomic: { status: 'supported' } }
                  };
                }

                // Handle wallet_sendCalls method
                if (args.method === 'wallet_sendCalls') {
                  // Get the original parameters
                  const params = args.params as any;
                  const calls = params[0].calls;
                  const from = params[0].from;

                  // Create modified parameters with 'from' address included
                  const modifiedParams = [
                    {
                      ...params[0],
                      calls: calls.map((call: any) => ({
                        ...call,
                        ...(typeof from !== 'undefined' ? { from } : {})
                      }))
                    }
                  ];

                  // Call the original implementation with modified parameters
                  const modifiedArgs = {
                    method: args.method,
                    params: modifiedParams
                  } as EIP1193Parameters<WalletRpcSchema>;

                  const originalResult = await target.request(modifiedArgs);

                  return originalResult;
                }

                // For all other methods, use the original implementation
                return target.request(args);
              };
            }
            return target[prop as keyof typeof target];
          }
        });
      }
    };
  });
}

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
    }),
    // Mock connector that adds suport for batch transactions
    extendedMock({
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
