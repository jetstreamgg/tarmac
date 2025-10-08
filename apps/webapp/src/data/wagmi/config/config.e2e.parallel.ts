import { http, WalletRpcSchema, EIP1193Parameters } from 'viem';
import { createConfig, createConnector, createStorage, noopStorage } from 'wagmi';
import {
  getTestTenderlyChains,
  TENDERLY_ARBITRUM_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_CHAIN_ID
} from './testTenderlyChain';
import { mock } from 'wagmi/connectors';
import { getTestWalletAddress } from '@/test/e2e/utils/testWallets';
import { optimism, unichain } from 'viem/chains';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain] =
  getTestTenderlyChains();

function extendedMock(getAccounts: () => [`0x${string}`, ...`0x${string}`[]]) {
  return createConnector(config => {
    // Dynamically get accounts when connector is created/used
    const accounts = getAccounts();
    const base = mock({ accounts, features: { reconnect: true } })(config);

    return {
      ...base,
      async getProvider({ chainId } = {}) {
        const provider = await base.getProvider({ chainId });

        return new Proxy(provider, {
          get(target, prop) {
            if (prop === 'request') {
              return async (args: EIP1193Parameters<WalletRpcSchema>) => {
                if (args.method === 'wallet_getCapabilities') {
                  return {
                    [TENDERLY_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [TENDERLY_BASE_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [TENDERLY_ARBITRUM_CHAIN_ID]: { atomic: { status: 'supported' } },
                    [optimism.id]: { atomic: { status: 'supported' } },
                    [unichain.id]: { atomic: { status: 'supported' } }
                  };
                }

                if (args.method === 'wallet_sendCalls') {
                  const params = args.params as any;
                  const calls = params[0].calls;
                  const from = params[0].from;

                  const modifiedParams = [
                    {
                      ...params[0],
                      calls: calls.map((call: any) => ({
                        ...call,
                        ...(typeof from !== 'undefined' ? { from } : {})
                      }))
                    }
                  ];

                  const modifiedArgs = {
                    method: args.method,
                    params: modifiedParams
                  } as EIP1193Parameters<WalletRpcSchema>;

                  return await target.request(modifiedArgs);
                }

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

// Get the account from the injected window variable
function getWorkerAccount(): [`0x${string}`, ...`0x${string}`[]] {
  console.log('getWorkerAccount called, window available:', typeof window !== 'undefined');

  if (typeof window !== 'undefined') {
    const testAccount = (window as any).__TEST_ACCOUNT__;
    console.log('__TEST_ACCOUNT__ value:', testAccount);
    if (testAccount) {
      console.log('✅ Using injected test account:', testAccount);
      // Return only the specific account for this test
      return [testAccount as `0x${string}`];
    }
  }

  // This should not happen - tests should always inject an account
  console.warn('⚠️ WARNING: No test account injected, falling back to default');
  // Use a default account just to avoid breaking, but log warning
  const fallbackAccount = getTestWalletAddress(0);
  console.log('❌ Using fallback account:', fallbackAccount);
  return [fallbackAccount];
}

export const mockWagmiConfig = createConfig({
  chains: [tenderlyMainnet, tenderlyBase, tenderlyArbitrum, tenderlyOptimism, tenderlyUnichain],
  connectors: [
    createConnector(config => {
      const baseConnector = mock({
        accounts: [getTestWalletAddress(0)], // Placeholder - will be overridden
        features: { reconnect: true }
      })(config);

      return {
        ...baseConnector,
        // Override getAccounts to be truly lazy
        async getAccounts() {
          const accounts = getWorkerAccount();
          console.log('🔍 getAccounts called, returning:', accounts);
          return accounts;
        }
      };
    }),
    createConnector(config => {
      const baseConnector = extendedMock(() => [getTestWalletAddress(0)])(config);

      return {
        ...baseConnector,
        // Override getAccounts to be truly lazy
        async getAccounts() {
          const accounts = getWorkerAccount();
          console.log('🔍 extendedMock getAccounts called, returning:', accounts);
          return accounts;
        }
      };
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
    key: `wagmi-mock-${(window as any).__WORKER_INDEX__ || 0}`
  })
});
