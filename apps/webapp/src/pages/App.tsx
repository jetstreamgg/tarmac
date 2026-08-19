import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { wagmiConfigDev, wagmiConfigMainnet } from '@/data/wagmi/config/config.default';
import { mockWagmiConfig } from '@/data/wagmi/config/config.e2e';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { DismissableLayerBranch } from '@radix-ui/react-dismissable-layer';
import { Toaster } from '@/components/ui/sonner';
import { ToastCloseAll } from '@/components/toast/ToastCloseAll';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConnectedProvider } from '@/modules/ui/context/ConnectedContext';
import { TermsModalProvider } from '@/modules/ui/context/TermsModalContext';
import { BalanceFiltersProvider } from '@/modules/ui/context/BalanceFiltersContext';
import { ChainModalProvider } from '@/modules/ui/context/ChainModalContext';
import { TransactionProvider } from '@/modules/ui/context/TransactionContext';
import { useTermsSignatureGate } from '@/modules/ui/hooks/useTermsSignatureGate';
import { useEnhancedScreeningPreflight } from '@/modules/ui/hooks/useEnhancedScreeningPreflight';
import { ConnectModalProvider } from '@/modules/ui/context/ConnectModalContext';
import { ConnectThenActProvider } from '@/modules/ui/context/ConnectThenActContext';
import { NetworkSwitchProvider } from '@/modules/ui/context/NetworkSwitchContext';
import { AnalyticsErrorBoundary } from '@/modules/analytics/AnalyticsErrorBoundary';
import { CookieConsentProvider } from '@/modules/analytics/context/CookieConsentContext';
import { PostHogProvider, POSTHOG_ENABLED } from '@/modules/analytics/PostHogProvider';
import { CookieConsentBanner } from '@/modules/analytics/components/CookieConsentBanner';
import { GeoConfigProvider } from '@/modules/geo-config';
import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import { useNavigationAnalytics } from '@/modules/analytics/hooks/useNavigationAnalytics';
import { CORPUS_VERSION, CORPUS_BRANCH, CORPUS_COMMIT } from '@/data/version';

// Expose corpus version to browser console for debugging
if (typeof window !== 'undefined') {
  (window as any).CORPUS_VERSION = CORPUS_VERSION;
  (window as any).CORPUS_BRANCH = CORPUS_BRANCH;
  (window as any).CORPUS_COMMIT = CORPUS_COMMIT;
}

const useMock = import.meta.env.VITE_USE_MOCK_WALLET === 'true';
// Vite sets MODE to production when running vite build
// https://vitejs.dev/guide/env-and-mode#modes
const useTestnetConfig =
  import.meta.env.VITE_TESTNET_CONFIG === 'true' || import.meta.env.MODE === 'development';

// Use mock config for tests, testnet config for development, mainnet for production
const config = useMock ? mockWagmiConfig : useTestnetConfig ? wagmiConfigDev : wagmiConfigMainnet;

// TransactionProvider with the real pre-transaction gate (APP-501) mounted:
// screening + the conditional terms signature run on every Confirm. Its own
// dialog (the screening-unavailable state) rides alongside the children.
// The enhanced-screening preflight (APP-517) gates the modal's CTAs for
// $250k+ transactions through the same provider seam.
const GatedTransactionProvider = ({ children }: { children: React.ReactNode }) => {
  const { gate, screeningDialog } = useTermsSignatureGate();
  return (
    <TransactionProvider gate={gate} usePreflight={useEnhancedScreeningPreflight}>
      {children}
      {screeningDialog}
    </TransactionProvider>
  );
};

const AppContent = () => {
  // Central nav subscription: lives outside the route tree so it survives
  // every navigation, 404s included.
  useNavigationAnalytics();
  return (
    <ConnectedProvider>
      <TermsModalProvider>
        <ConnectThenActProvider>
          <BalanceFiltersProvider>
            <TooltipProvider delayDuration={300}>
              <ChainModalProvider>
                <NetworkSwitchProvider>
                  <GatedTransactionProvider>
                    {/* Toast tier above the dialog tier (z-50): network/tx
                        toasts must stay readable over a modal's blurred
                        overlay (e.g. the auto-switch toast fires as a supply
                        modal opens). Below the popover (z-100) and tooltip
                        (z-101) tiers. ToastCloseAll rides one step above the
                        stack it controls.

                        The DismissableLayerBranch keeps toasts *clickable*
                        while a modal Radix surface (wallet drawer, any
                        dialog) is open.

                        app-loader-cover-hidden: this tree mounts outside
                        Layout, so it hides via the loader's document flag
                        while the cover plays (globals.css). */}
                    <DismissableLayerBranch className="app-loader-cover-hidden pointer-events-auto">
                      <Toaster className="!z-[60]" />
                      <ToastCloseAll />
                    </DismissableLayerBranch>
                    <RouterProvider router={router} />
                  </GatedTransactionProvider>
                </NetworkSwitchProvider>
              </ChainModalProvider>
            </TooltipProvider>
          </BalanceFiltersProvider>
        </ConnectThenActProvider>
      </TermsModalProvider>
    </ConnectedProvider>
  );
};

export const App = () => (
  <I18nProvider i18n={i18n}>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AnalyticsErrorBoundary>
          <CookieConsentProvider>
            <PostHogProvider>
              <GeoConfigProvider>
                <AnalyticsFlowProvider>
                  <ConnectModalProvider>
                    <AppContent />
                  </ConnectModalProvider>
                </AnalyticsFlowProvider>
                {POSTHOG_ENABLED && (
                  <div className="app-loader-cover-hidden">
                    <CookieConsentBanner />
                  </div>
                )}
              </GeoConfigProvider>
            </PostHogProvider>
          </CookieConsentProvider>
        </AnalyticsErrorBoundary>
      </QueryClientProvider>
    </WagmiProvider>
  </I18nProvider>
);
