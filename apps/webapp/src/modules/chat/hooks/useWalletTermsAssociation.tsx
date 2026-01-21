import { useCallback, useRef, useEffect } from 'react';
import { useConnection } from 'wagmi';
import { checkChatbotTerms } from '../services/termsApi';
import { shouldSkipAssociation, triggerWalletAssociation } from '../services/walletTermsAssociation';
import { CHATBOT_ENABLED } from '@/lib/constants';
import { isChatbotRestrictedError } from '../lib/ChatbotRestrictedError';
import { useChatContext } from '../context/ChatContext';

export const useWalletTermsAssociation = (): void => {
  const { address, isConnected } = useConnection();
  const { setIsRestricted, setChatHistory } = useChatContext();
  const isAssociatingRef = useRef(false);
  const pendingAddressRef = useRef<string | null>(null);

  const processPendingAssociation = useCallback(async () => {
    if (isAssociatingRef.current || !pendingAddressRef.current) {
      return;
    }

    isAssociatingRef.current = true;

    try {
      while (pendingAddressRef.current) {
        const walletToAssociate = pendingAddressRef.current;
        pendingAddressRef.current = null;

        if (!walletToAssociate || shouldSkipAssociation(walletToAssociate)) {
          continue;
        }

        const termsStatus = await checkChatbotTerms();

        if (termsStatus.accepted) {
          await triggerWalletAssociation(walletToAssociate);
        }
      }
    } catch (error) {
      if (isChatbotRestrictedError(error)) {
        setIsRestricted(true);
        setChatHistory([]);
        return;
      }
      console.error('[useWalletTermsAssociation] Failed:', error);
    } finally {
      isAssociatingRef.current = false;

      if (pendingAddressRef.current) {
        void processPendingAssociation();
      }
    }
  }, [setIsRestricted, setChatHistory]);

  const queueAssociation = useCallback(
    (walletAddress: string | null | undefined) => {
      if (!walletAddress) {
        pendingAddressRef.current = null;
        return;
      }

      pendingAddressRef.current = walletAddress;

      if (!isAssociatingRef.current) {
        void processPendingAssociation();
      }
    },
    [processPendingAssociation]
  );

  useEffect(() => {
    if (!CHATBOT_ENABLED) {
      return;
    }

    if (isConnected && address) {
      queueAssociation(address);
    } else {
      pendingAddressRef.current = null;
    }
  }, [address, isConnected, queueAssociation]);
};
