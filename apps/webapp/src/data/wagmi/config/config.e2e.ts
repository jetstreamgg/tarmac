import { http, WalletRpcSchema, EIP1193Parameters } from 'viem';
import { createConfig, createConnector, createStorage, noopStorage } from 'wagmi';
import { getTestTenderlyChains, TENDERLY_CHAIN_ID } from './testTenderlyChain';
import { mock, MockParameters } from 'wagmi/connectors';
import { TEST_WALLET_ADDRESSES, getTestWalletAddress } from '@/test/e2e/utils/testWallets';
import { arbitrum, base, optimism, unichain } from 'viem/chains';

const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain] =
  getTestTenderlyChains();

function extendedMock(params: MockParameters) {
  return createConnector(config => {
    const baseMock = mock(params)(config);

    return {
      ...baseMock,
      async getProvider({ chainId } = {}) {
        const provider = await baseMock.getProvider({ chainId });

        // Create a proxy to intercept requests
        return new Proxy(provider, {
          get(target, prop) {
            if (prop === 'request') {
              return async (args: EIP1193Parameters<WalletRpcSchema>) => {
                // Log all requests to see what's being called
                console.log('extendedMock request:', args.method, args.params);

                // Handle wallet_getCapabilities method
                if (args.method === 'wallet_getCapabilities') {
                  return {
                    // Add capabilities for different chains
                    [TENDERLY_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [base.id]: { atomic: { status: 'supported' } },
                    [arbitrum.id]: { atomic: { status: 'supported' } },
                    [optimism.id]: { atomic: { status: 'supported' } },
                    [unichain.id]: { atomic: { status: 'supported' } }
                  };
                }

                // Handle eth_requestAccounts method
                if (args.method === 'eth_requestAccounts') {
                  return params.accounts;
                }

                // Handle eth_accounts method
                if (args.method === 'eth_accounts') {
                  return params.accounts;
                }

                // Handle eth_chainId method
                // if (args.method === 'eth_chainId') {
                //   // Return the current chain ID as hex
                //   const chainIdHex = `0x${TENDERLY_CHAIN_ID.toString(16)}`;
                //   console.log(
                //     'eth_chainId returning:',
                //     chainIdHex,
                //     'for TENDERLY_CHAIN_ID:',
                //     TENDERLY_CHAIN_ID
                //   );
                //   return chainIdHex;
                // }

                // Handle wallet_sendCalls method
                if (args.method === 'wallet_sendCalls') {
                  // Get the original parameters
                  const params = args.params as any;
                  const calls = params[0].calls;
                  const from = params[0].from;
                  // change from address to the first account in the worker accounts
                  // const workerIndex = Number(import.meta.env.VITE_TEST_WORKER_INDEX || 0);
                  // const account = TEST_WALLET_ADDRESSES[workerIndex % TEST_WALLET_ADDRESSES.length];

                  // Create modified parameters with 'from' address included
                  const modifiedParams = [
                    {
                      ...params[0],
                      // from: account,
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

// Get worker index from environment variable or window object
function getWorkerAccounts(): [`0x${string}`, ...`0x${string}`[]] {
  // First check if we have a specific account injected by the test
  if (typeof window !== 'undefined' && (window as any).__TEST_ACCOUNT__) {
    const account = (window as any).__TEST_ACCOUNT__ as `0x${string}`;
    return [account];
  }

  // Use the dynamic getTestWalletAddress function which handles:
  // - Custom addresses via env vars
  // - Seed-based generation
  // - Unlimited address generation
  const workerIndex = Number(import.meta.env.VITE_TEST_WORKER_INDEX || 0);
  const account = getTestWalletAddress(workerIndex);

  // For parallel execution, return only the worker's specific account
  // This ensures each worker uses a different account
  if (import.meta.env.VITE_PARALLEL_TEST === 'true') {
    return [account];
  }

  // For non-parallel tests, return all accounts (existing behavior)
  return TEST_WALLET_ADDRESSES as [`0x${string}`, ...`0x${string}`[]];
}

// Clear old wagmi storage to prevent cached address issues
if (useMock && typeof window !== 'undefined' && window.localStorage) {
  // Clear ALL localStorage to ensure no cached state
  window.localStorage.clear();
}

const workerAccounts = getWorkerAccounts();

export const mockWagmiConfig = createConfig({
  chains: [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain],
  connectors: [
    mock({
      accounts: workerAccounts,
      features: {
        reconnect: false // Disable reconnect to prevent using old cached accounts
      }
    }),
    // Mock connector that adds suport for batch transactions
    extendedMock({
      accounts: workerAccounts,
      features: {
        reconnect: false // Disable reconnect to prevent using old cached accounts
      }
    })
  ],
  transports: {
    [tenderlyMainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [unichain.id]: http()
  },
  storage: createStorage({
    storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage,
    key: `wagmi-mock-v2-${(window as any).__WORKER_INDEX__ || import.meta.env.VITE_TEST_WORKER_INDEX || 0}`
  })
});
