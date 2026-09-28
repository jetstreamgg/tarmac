import { ReactNode } from 'react';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '../../auth/components/UnauthorizedPage';

export const AuthWrapper = ({ children }: { children: ReactNode }) => {
  const { isAuthorized, authData, vpnData, accessBlockReason, retryAccessChecks } = useConnectedContext();

  // The gate is a sibling, never a wrapper: swapping the element around
  // `children` would remount the whole page when a verdict lands mid-flow,
  // dropping open forms and re-opening URL-driven modals over the gate.
  return (
    <>
      {children}
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
