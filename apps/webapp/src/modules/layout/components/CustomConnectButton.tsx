import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { TermsModal } from '../../ui/components/TermsModal';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { t } from '@lingui/core/macro';
import { useConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { UnauthorizedPage } from '../../auth/components/UnauthorizedPage';
import { useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { CustomAvatar } from '@/modules/ui/components/Avatar';

export function CustomConnectButton(props: any) {
  const defaultProps = {
    accountStatus: {
      smallScreen: 'avatar',
      largeScreen: 'full'
    },
    chainStatus: 'none',
    showBalance: false,
    label: 'Connect Wallet'
  };
  const mergedProps = { ...defaultProps, ...props };
  const { openConnectModal } = useConnectModal();
  const { isConnected, address } = useAccount();
  const isSafeWallet = useIsSafeWallet();

  const { isConnectedAndAcceptedTerms, isAuthorized, authData, vpnData } = useConnectedContext();

  if (!isAuthorized) {
    return (
      <UnauthorizedPage authData={authData} vpnData={vpnData}>
        <Button variant="connect" onClick={openConnectModal}>
          {props.label ? props.label : t`Connect Wallet`}
        </Button>
      </UnauthorizedPage>
    );
  }

  return !isConnectedAndAcceptedTerms ? (
    <TermsModal />
  ) : !isConnected ? (
    <Button variant="connect" onClick={openConnectModal}>
      {props.label ? props.label : t`Connect Wallet`}
    </Button>
  ) : isSafeWallet && !!address && isConnected ? (
    <Button variant="connectPrimary" disabled className="disabled:text-text text-base">
      <div className="flex items-center gap-2">
        <CustomAvatar address={address || ''} size={24} />
        {`safe:${address.slice(0, 6)}...${address.slice(-4)}`}
      </div>
    </Button>
  ) : (
    <div className="p-0">
      <ConnectButton {...mergedProps} />
    </div>
  );
}
