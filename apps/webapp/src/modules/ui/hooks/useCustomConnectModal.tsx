import { useMemo } from 'react';
import { useConnection } from 'wagmi';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useTermsModal } from '@/modules/ui/context/TermsModalContext';
import { useConnectedContext } from '../context/ConnectedContext';

export function useCustomConnectModal() {
  const { openConnectModal } = useConnectModal();
  const { isConnectedAndAcceptedTerms } = useConnectedContext();
  const { openModal } = useTermsModal();
  const { isConnected } = useConnection();

  const action = useMemo(() => {
    if (!isConnectedAndAcceptedTerms) {
      return openModal;
    } else {
      return openConnectModal;
    }
  }, [isConnectedAndAcceptedTerms, openConnectModal, openModal, isConnected]);

  return action;
}
