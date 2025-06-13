/// <reference types="vite/client" />

import React from 'react';
import { mock, MockParameters } from 'wagmi/connectors';

import { createConfig, WagmiProvider, http, createConnector } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { getTenderlyChains } from './tenderlyChain';
import { TEST_WALLET_ADDRESS } from './constants';
import { createTestClient, EIP1193Parameters, WalletRpcSchema } from 'viem';
import { TENDERLY_BASE_CHAIN_ID } from '../src/constants';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum] = getTenderlyChains();

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
                    [TENDERLY_BASE_CHAIN_ID]: { atomic: { status: 'supported' } }
                  };
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
