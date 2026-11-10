import type { ReactNode } from 'react';
import { PageModalHoldContext } from '@/components/ui/pageModalHold';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from './UnauthorizedPage';

/**
 * The app-wide access gate, mounted once around the router. It sits outside
 * every page and header error boundary, so a render error elsewhere can't take
 * it down, and it doesn't wrap the page, so a verdict landing mid-flow doesn't
 * remount it (APP-601).
 *
 * While the gate is up, page dialogs and sheets are held closed (see
 * PageModalHoldContext). The gate renders outside that hold.
 */
export const AccessGate = ({ children }: { children: ReactNode }) => {
  const { isAuthorized, authData, vpnData, accessBlockReason, retryAccessChecks } = useConnectedContext();
  const isGateUp = !isAuthorized && !authData.authIsLoading && !vpnData.vpnIsLoading;

  return (
    <>
      <PageModalHoldContext.Provider value={isGateUp}>{children}</PageModalHoldContext.Provider>
      {!isAuthorized && (
        <UnauthorizedPage
          authData={authData}
          vpnData={vpnData}
          blockReason={accessBlockReason}
          onRetry={retryAccessChecks}
        />
      )}
    </>
  );
};
