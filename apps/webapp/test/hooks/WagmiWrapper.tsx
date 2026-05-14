/// <reference types="vite/client" />

import React from 'react';
import { mock, MockParameters } from 'wagmi/connectors';

import { createConfig, WagmiProvider, http, createConnector } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { getTenderlyChains } from './tenderlyChain';
import { TEST_WALLET_ADDRESS } from './constants';
import { createTestClient, EIP1193Parameters, WalletRpcSchema } from 'viem';
import { optimism, unichain } from 'viem/chains';

const [tenderlyMainnet, tenderlyArbitrum, tenderlyBase] = getTenderlyChains();

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
                // Handle eth_accounts to return our test wallet address
                // This ensures simulations use the correct sender address
                if (args.method === 'eth_accounts') {
                  return params.accounts;
                }

                // Handle wallet_getCapabilities method
                if (args.method === 'wallet_getCapabilities') {
                  return {
                    // Add capabilities for different chains
                    [tenderlyMainnet.id]: { atomic: { status: 'supported' } },
                    [tenderlyBase.id]: { atomic: { status: 'supported' } },
                    [tenderlyArbitrum.id]: { atomic: { status: 'supported' } },
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

export const config = createConfig({
  chains: [tenderlyMainnet, tenderlyBase, tenderlyArbitrum],
  connectors: [
    extendedMock({
      accounts: [TEST_WALLET_ADDRESS],
      features: {
        reconnect: true
      }
    })
  ],
  transports: {
    [tenderlyMainnet.id]: http(),
    [tenderlyBase.id]: http(),
    [tenderlyArbitrum.id]: http()
  }
});

const queryClient = new QueryClient();

export function WagmiWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export const testClientMainnet = createTestClient({
  chain: tenderlyMainnet,
  mode: 'anvil',
  transport: http()
});

export const testClientBase = createTestClient({
  chain: tenderlyBase,
  mode: 'anvil',
  transport: http()
});

export const testClientArbitrum = createTestClient({
  chain: tenderlyArbitrum,
  mode: 'anvil',
  transport: http()
});
