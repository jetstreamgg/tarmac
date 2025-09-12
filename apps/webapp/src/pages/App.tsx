import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfigDev, wagmiConfigMainnet } from '@/data/wagmi/config/config.default';
import { mockWagmiConfig } from '@/data/wagmi/config/config.e2e';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConnectedProvider } from '@/modules/ui/context/ConnectedContext';
import { TermsModalProvider } from '@/modules/ui/context/TermsModalContext';
import { BalanceFiltersProvider } from '@/modules/ui/context/BalanceFiltersContext';
import { ChainModalProvider } from '@/modules/ui/context/ChainModalContext';
import { ConnectModalProvider } from '@/modules/ui/context/ConnectModalContext';
import { ExternalLinkModal } from '@/modules/layout/components/ExternalLinkModal';
import { ChatProvider } from '@/modules/chat/context/ChatContext';

const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true';
// Vite sets MODE to production when running vite build
// https://vitejs.dev/guide/env-and-mode#modes
const useTestnetConfig =
  import.meta.env.VITE_TESTNET_CONFIG === 'true' || import.meta.env.MODE === 'development';

// Use mock config for tests, testnet config for development, mainnet for production
const config = useMock ? mockWagmiConfig : useTestnetConfig ? wagmiConfigDev : wagmiConfigMainnet;

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <ConnectedProvider>
      <ChatProvider>
        <TermsModalProvider>
          <BalanceFiltersProvider>
            <TooltipProvider delayDuration={300}>
              <ChainModalProvider>
                <ExternalLinkModal />
                <Toaster />
                <RouterProvider router={router} />
              </ChainModalProvider>
            </TooltipProvider>
          </BalanceFiltersProvider>
        </TermsModalProvider>
      </ChatProvider>
    </ConnectedProvider>
  );
};

export const App = () => (
  <I18nProvider i18n={i18n}>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectModalProvider>
          <AppContent />
        </ConnectModalProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </I18nProvider>
);
