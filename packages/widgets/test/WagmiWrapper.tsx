/// <reference types="vite/client" />

import React from 'react';
import { MakerHooksProvider } from '../src/context/context';
import { mock } from 'wagmi/connectors';
import { createConfig, WagmiProvider, http } from 'wagmi';
import { mnemonicToAccount } from 'viem/accounts';
import { normalize } from 'viem/ens';
import { I18nWidgetProvider } from '../src/context/I18nWidgetProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getTenderlyChains } from './tenderlyChain';

// TODO move this file (along with its counterpart in hooks) into a tests helper package or something

// TODO move back to utils or somewhere appropriate
const mnemonic = 'hill law jazz limb penalty escape public dish stand bracket blue jar';
const account = mnemonicToAccount(mnemonic);
const MOCK_TEST_ACCOUNTS = [account.address] as const;

const mockConnector = mock({
  accounts: MOCK_TEST_ACCOUNTS
});

const [tenderlyMainnet, tenderlyBase] = getTenderlyChains();

const config = createConfig({
  chains: [tenderlyMainnet, tenderlyBase],
  connectors: [mockConnector],
  transports: {
    [tenderlyMainnet.id]: http(),
    [tenderlyBase.id]: http()
  }
});

const queryClient = new QueryClient();

export function WagmiWrapper({ children }: { children?: React.ReactElement }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <I18nWidgetProvider locale="en">
          <MakerHooksProvider
            config={{
              delegates: {
                ens: normalize('vitalik.eth')
              },
              ipfs: {
                gateway: 'dweb.link'
              }
            }}
          >
            {children}
          </MakerHooksProvider>
        </I18nWidgetProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
