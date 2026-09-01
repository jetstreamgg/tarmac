import { ReactNode } from 'react';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '../../auth/components/UnauthorizedPage';

export const AuthWrapper = ({ children }: { children: ReactNode }) => {
  const { isAuthorized, authData, vpnData, accessBlockReason, retryAccessChecks } = useConnectedContext();

  return isAuthorized ? (
    <>{children}</>
  ) : (
    <UnauthorizedPage
      authData={authData}
      vpnData={vpnData}
      blockReason={accessBlockReason}
      onRetry={retryAccessChecks}
    >
      {children}
    </UnauthorizedPage>
  );
};
