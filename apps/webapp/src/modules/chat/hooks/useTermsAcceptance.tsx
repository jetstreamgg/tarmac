import { useState, useEffect, useCallback } from 'react';
import { checkChatbotTerms, signChatbotTerms } from '../services/termsApi';
import { useChatContext } from '../context/ChatContext';

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
  const { termsAccepted, setTermsAccepted, showTermsModal, setShowTermsModal, isCheckingTerms, termsError } =
    useChatContext();

  const [isCheckingTermsLocal, setIsCheckingTermsLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Clear error when dialog visibility changes
  useEffect(() => {
    if (showTermsModal) {
      setError(null);
    }
  }, [showTermsModal]);

  const checkTermsStatus = useCallback(async () => {
    // Only check if we haven't checked yet
    if (hasCheckedOnce && termsAccepted) {
      return;
    }

    setIsCheckingTermsLocal(true);
    setError(null);

    try {
      const response = await checkChatbotTerms();
      setTermsAccepted(response.accepted);
      setHasCheckedOnce(true);

      if (!response.accepted) {
        setShowTermsModal(true);
      }
    } catch (err) {
      console.error('Failed to check terms status:', err);
      setTermsAccepted(false);
      setShowTermsModal(true);
      setHasCheckedOnce(true);
    } finally {
      setIsCheckingTermsLocal(false);
    }
  }, [hasCheckedOnce, termsAccepted, setTermsAccepted, setShowTermsModal]);

  const acceptTerms = useCallback(
    async (termsVersion: string) => {
      setError(null);

      try {
        await signChatbotTerms(termsVersion);
        setTermsAccepted(true);
        setShowTermsModal(false);
      } catch (err) {
        console.error('Failed to accept terms:', err);
        setError('Failed to accept terms. Please try again.');
        throw err;
      }
    },
    [setTermsAccepted, setShowTermsModal]
  );

  return {
    termsAccepted,
    isCheckingTerms: isCheckingTermsLocal || isCheckingTerms,
    showTermsDialog: showTermsModal,
    acceptTerms,
    checkTermsStatus,
    setShowTermsDialog: setShowTermsModal,
    error: error || termsError
  };
};
