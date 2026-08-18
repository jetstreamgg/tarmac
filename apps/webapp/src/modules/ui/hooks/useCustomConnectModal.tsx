import { useCallback, useMemo } from 'react';
import { useConnection } from 'wagmi';
import { useConnectModal } from '@/modules/ui/context/ConnectModalContext';
import { useTermsModal } from '@/modules/ui/context/TermsModalContext';
import { useConnectedContext } from '../context/ConnectedContext';

export function useCustomConnectModal() {
  const { openConnectModal } = useConnectModal();
  const { isConnectedAndAcceptedTerms, termsCheckError, retryTermsCheck } = useConnectedContext();
  const { openModal } = useTermsModal();
  const { isConnected } = useConnection();

  const retryAndShowModal = useCallback(() => {
    retryTermsCheck();
    openModal();
  }, [retryTermsCheck, openModal]);

  const action = useMemo<() => void>(() => {
    if (termsCheckError) {
      // Fallback: the error modal should auto-open, but if it's dismissed this ensures
      // the connect button still retries rather than opening the wallet picker.
      return retryAndShowModal;
    } else if (!isConnectedAndAcceptedTerms) {
      return openModal;
    } else {
      // Wrapped: callers use this as an onClick handler, and openConnectModal's
      // optional arg is the analytics connect_reason, not an event.
      return () => openConnectModal();
    }
  }, [
    isConnectedAndAcceptedTerms,
    openConnectModal,
    openModal,
    isConnected,
    termsCheckError,
    retryAndShowModal
  ]);

  return action;
}
