/// <reference types="vite/client" />

import React from 'react';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
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

// TanStack Router's RouterProvider renders a route tree instead of children,
// so the test router's root route renders the wrapper's children. Children are
// passed through context (not closed over at router creation) so `rerender`
// updates content without remounting the tree, and the router instance stays
// stable across rerenders.
const RouterChildrenContext = React.createContext<React.ReactNode>(null);

function RootChildren() {
  return <>{React.useContext(RouterChildrenContext)}</>;
}

function MemoryRouterProvider({ children }: { children?: React.ReactNode }) {
  const router = React.useMemo(
    () =>
      createRouter({
        routeTree: createRootRoute({ component: RootChildren }),
        history: createMemoryHistory({ initialEntries: ['/'] })
      }),
    []
  );

  return (
    <RouterChildrenContext.Provider value={children}>
      <RouterProvider router={router} />
    </RouterChildrenContext.Provider>
  );
}

// Fake ConnectedContext value for widget unit/integration tests: treat the test
// wallet as connected + terms-accepted. Preserves the pre-migration behavior of
// widgets that used to default `enabled = true` from their props.
const testConnectedContextValue = {
  isConnectedAndAcceptedTerms: true,
  isAuthorized: true,
  isCheckingTerms: false,
  termsCheckError: false,
  termsCheckDenied: false,
  retryTermsCheck: () => {},
  retryAccessChecks: () => {},
  hasAcceptedTerms: true,
  hasSignedCurrentTerms: true,
  acceptTerms: async () => true,
  signTerms: async () => 'signed' as const,
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
        <MemoryRouterProvider>
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
        </MemoryRouterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
