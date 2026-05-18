/// <reference types="vite/client" />

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MakerHooksProvider } from '../../src/widgets/context/context';
import { mock } from 'wagmi/connectors';
import { createConfig, WagmiProvider, http } from 'wagmi';
import { mnemonicToAccount } from 'viem/accounts';
import { normalize } from 'viem/ens';
import { I18nWidgetProvider } from '../../src/widgets/context/I18nWidgetProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectedContext } from '../../src/modules/ui/context/ConnectedContext';
import { ConnectModalContext } from '../../src/modules/ui/context/ConnectModalContext';
import { AnalyticsFlowProvider } from '../../src/modules/analytics/context/AnalyticsFlowContext';
import { getTenderlyChains } from './tenderlyChain';

// TODO move this file (along with its counterpart in hooks) into a tests helper package or something

// TODO move back to utils or somewhere appropriate
const mnemonic = 'hill law jazz limb penalty escape public dish stand bracket blue jar';
const account = mnemonicToAccount(mnemonic);
const MOCK_TEST_ACCOUNTS = [account.address] as const;

const mockConnector = mock({
  accounts: MOCK_TEST_ACCOUNTS
});

const [tenderlyMainnet] = getTenderlyChains();

const config = createConfig({
  chains: [tenderlyMainnet],
  connectors: [mockConnector],
  transports: {
    [tenderlyMainnet.id]: http()
  }
});

const queryClient = new QueryClient();

// Fake ConnectedContext value for widget unit/integration tests: treat the test
// wallet as connected + terms-accepted. Preserves the pre-migration behavior of
// widgets that used to default `enabled = true` from their props.
const testConnectedContextValue = {
  isConnectedAndAcceptedTerms: true,
  isAuthorized: true,
  setHasAcceptedTerms: () => {},
  isCheckingTerms: false,
  termsCheckError: false,
  retryTermsCheck: () => {},
  authData: { authIsLoading: false },
  vpnData: { vpnIsLoading: false }
};

// Fake ConnectModalContext value: useCustomConnectModal() throws without a
// provider, and widgets now call it inline rather than receiving onConnect as
// a prop.
const testConnectModalContextValue = {
  isOpen: false,
  openConnectModal: () => {},
  closeConnectModal: () => {}
};

export function WagmiWrapper({ children }: { children?: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <I18nWidgetProvider locale="en">
            <ConnectedContext.Provider value={testConnectedContextValue}>
              <ConnectModalContext.Provider value={testConnectModalContextValue}>
                <AnalyticsFlowProvider>
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
                </AnalyticsFlowProvider>
              </ConnectModalContext.Provider>
            </ConnectedContext.Provider>
          </I18nWidgetProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
