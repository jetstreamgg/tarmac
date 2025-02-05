/// <reference types="vite/client" />

import React from 'react';
import { mock } from 'wagmi/connectors';

import { createConfig, WagmiProvider, http } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { getTenderlyChains } from './tenderlyChain';
import { TEST_WALLET_ADDRESS } from './constants';
import { createTestClient } from 'viem';

const [tenderlyMainnet, tenderlyBase, tenderlyArbitrum] = getTenderlyChains();

export const config = createConfig({
  chains: [tenderlyMainnet, tenderlyBase, tenderlyArbitrum],
  connectors: [
    mock({
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
