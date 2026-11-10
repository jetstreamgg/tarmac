import type { ReactNode } from 'react';
import { PageModalHoldContext } from '@/components/ui/pageModalHold';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from './UnauthorizedPage';

type AccessGateProps = {
  children: ReactNode;
};

/**
 * The app-wide access gate, mounted once just inside ConnectedProvider. It
 * sits outside every page and header error boundary, so a render error
 * elsewhere can't take it down, and it doesn't remount the page when a verdict
 * lands mid-flow (APP-601).
 *
 * The gate shows once a block verdict is in. While the checks are in flight,
 * WalletChip's ConnectChecksCover holds the screen instead, and the dialog
 * mounts only afterwards so it doesn't resize from the waiting card.
 *
 * While the gate is up, every dialog and sheet below it is held closed (see
 * PageModalHoldContext). The gate itself renders outside that hold.
 */
export const AccessGate = ({ children }: AccessGateProps) => {
  const { isAuthorized, authData, vpnData, accessBlockReason, retryAccessChecks, isRetryingAccessChecks } =
    useConnectedContext();
  const isGateUp = !isAuthorized && !authData.authIsLoading && !vpnData.vpnIsLoading;

  return (
    <>
      <PageModalHoldContext.Provider value={isGateUp}>{children}</PageModalHoldContext.Provider>
      {isGateUp && (
        <UnauthorizedPage
          blockReason={accessBlockReason}
          countryCode={vpnData.countryCode}
          onRetry={retryAccessChecks}
          isRetrying={isRetryingAccessChecks}
        />
      )}
    </>
  );
};
