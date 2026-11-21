import { type ReactNode } from 'react';
import { AccessGateUpContext } from '@/components/ui/accessGateHold';
import { ConnectChecksCover } from '@/modules/ui/components/ConnectChecksCover';
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
 * ConnectChecksCover holds the screen instead, and the dialog mounts only
 * afterwards so it doesn't resize from the waiting card.
 *
 * While the gate is up, every dialog and sheet below it is forced closed (see
 * accessGateHold.ts for why). The gate itself renders outside that provider.
 */
export const AccessGate = ({ children }: AccessGateProps) => {
  const {
    isAuthorized,
    isConnectedAndAcceptedTerms,
    isCheckingTerms,
    authData,
    vpnData,
    accessBlockReason,
    retryAccessChecks,
    isRetryingAccessChecks
  } = useConnectedContext();
  // An unauthorized session is in one of two states: its checks are still
  // running (the cover shows), or a verdict is in (the gate shows).
  const isChecking = !isAuthorized && (authData.authIsLoading || vpnData.vpnIsLoading);
  const isGateUp = !isAuthorized && !isChecking;

  // Connecting a wallet runs two checks in a row: the terms check, then
  // (only if the terms still need accepting) address screening. One cover
  // spans both.
  //
  // The terms half is gated on the terms not being accepted yet: a background
  // re-check for an already-accepted wallet must not throw a scrim over the
  // app. It is gated on `isAuthorized` as well, because the terms check fires
  // on connection alone while a region block comes from the separate VPN
  // query: an address in a restricted region is blocked *and* checking terms
  // at once, and the cover must not sit on top of the gate.
  const showChecksCover = isChecking || (isAuthorized && !isConnectedAndAcceptedTerms && isCheckingTerms);

  return (
    <>
      <AccessGateUpContext.Provider value={isGateUp}>{children}</AccessGateUpContext.Provider>
      <ConnectChecksCover open={showChecksCover} />
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
