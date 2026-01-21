import { useState, useEffect, useCallback } from 'react';
import { checkChatbotTerms, signChatbotTerms } from '../services/termsApi';
import { useChatContext } from '../context/ChatContext';
import { SKIP_CHAT_AUTH_CHECK } from '@/lib/constants';
import { isChatbotRestrictedError } from '../lib/ChatbotRestrictedError';

interface UseTermsAcceptanceReturn {
  termsAccepted: boolean;
  isCheckingTerms: boolean;
  showTermsDialog: boolean;
  acceptTerms: (termsVersion: string) => Promise<void>;
  checkTermsStatus: () => Promise<void>;
  setShowTermsDialog: (show: boolean) => void;
  error: string | null;
}

export const useTermsAcceptance = (): UseTermsAcceptanceReturn => {
  const {
    termsAccepted,
    setTermsAccepted,
    showTermsModal,
    setShowTermsModal,
    isCheckingTerms,
    termsError,
    setTermsError,
    setIsRestricted,
    setChatHistory
  } = useChatContext();

  const [isCheckingTermsLocal, setIsCheckingTermsLocal] = useState(false);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Clear error when dialog visibility changes
  useEffect(() => {
    if (showTermsModal) {
      setTermsError(null);
    }
  }, [showTermsModal]);

  const checkTermsStatus = useCallback(async () => {
    // Skip auth check for testing purposes
    if (SKIP_CHAT_AUTH_CHECK) {
      setTermsAccepted(true);
      setHasCheckedOnce(true);
      return;
    }

    // Only check if we haven't checked yet
    if (hasCheckedOnce && termsAccepted) {
      return;
    }

    setIsCheckingTermsLocal(true);
    setTermsError(null);

    try {
      const response = await checkChatbotTerms();
      setTermsAccepted(response.accepted);
      setHasCheckedOnce(true);

      if (!response.accepted) {
        setShowTermsModal(true);
      }
    } catch (err) {
      if (isChatbotRestrictedError(err)) {
        setIsRestricted(true);
        setChatHistory([]);
        return;
      }
      console.error('Failed to check terms status:', err);
      setTermsAccepted(false);
      setShowTermsModal(true);
      setHasCheckedOnce(true);
    } finally {
      setIsCheckingTermsLocal(false);
    }
  }, [hasCheckedOnce, termsAccepted, setTermsAccepted, setShowTermsModal, setIsRestricted, setChatHistory]);

  const acceptTerms = useCallback(
    async (termsVersion: string) => {
      setTermsError(null);

      try {
        await signChatbotTerms(termsVersion);
        setTermsAccepted(true);
        setShowTermsModal(false);
      } catch (err) {
        if (isChatbotRestrictedError(err)) {
          setShowTermsModal(false);
          setIsRestricted(true);
          setChatHistory([]);
          return;
        }
        console.error('Failed to accept terms:', err);
        setTermsError('Failed to accept terms. Please try again.');
        throw err;
      }
    },
    [setTermsAccepted, setShowTermsModal, setIsRestricted, setChatHistory, setTermsError]
  );

  return {
    termsAccepted,
    isCheckingTerms: isCheckingTermsLocal || isCheckingTerms,
    showTermsDialog: showTermsModal,
    acceptTerms,
    checkTermsStatus,
    setShowTermsDialog: setShowTermsModal,
    error: termsError
  };
};
