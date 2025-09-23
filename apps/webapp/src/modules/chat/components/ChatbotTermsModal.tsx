import React, { useState, useEffect, useRef, useCallback } from 'react';
import { t } from '@lingui/core/macro';
import { TermsDialog } from '@/modules/ui/components/TermsDialog';
import { TermsMarkdownRenderer } from '@/modules/ui/components/markdown/TermsMarkdownRenderer';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';
import { Text } from '@/modules/layout/components/Typography';

interface ChatbotTermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  termsVersion: string;
  termsContent?: string;
  isLoading?: boolean;
  error?: string | null;
  termsLoadedSuccessfully?: boolean;
}

export const ChatbotTermsModal: React.FC<ChatbotTermsModalProps> = ({
  isOpen,
  onAccept,
  onDecline,
  termsVersion,
  termsContent,
  isLoading = false,
  error = null,
  termsLoadedSuccessfully = true
}) => {
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [isPrivacyChecked, setIsPrivacyChecked] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  // Track accept-driven close to avoid firing onDecline on success
  const closedByAcceptRef = useRef(false);
  const checkboxLabel = import.meta.env.VITE_CHATBOT_CHECKBOX_LABEL;
  const termsLabel =
    import.meta.env.VITE_CHATBOT_CHECKBOX_TERMS_LABEL ||
    t`By clicking accept, you confirm agreement to the Chatbot Terms of Use.`;
  const privacyLabel = import.meta.env.VITE_CHATBOT_CHECKBOX_PRIVACY_LABEL || t`I accept the privacy policy.`;

  // Reset checkboxes when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsTermsChecked(false);
      setIsPrivacyChecked(false);
      setHasScrolledToEnd(false);
    }
  }, [isOpen]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (!closedByAcceptRef.current) onDecline();
        closedByAcceptRef.current = false;
      }
    },
    [onDecline]
  );

  const handleTermsCheckboxChange = (checkedState: CheckedState) => {
    setIsTermsChecked(checkedState === true);
  };

  const handlePrivacyCheckboxChange = (checkedState: CheckedState) => {
    setIsPrivacyChecked(checkedState === true);
  };

  // Compute button text based on state
  const getButtonText = () => {
    if (isLoading) return t`Processing...`;
    if (!hasScrolledToEnd) return t`Scroll down ↓`;
    if (!isTermsChecked || !isPrivacyChecked) return t`Check to continue`;
    return t`I Agree`;
  };

  const checkboxContent = (scrolledToEnd: boolean) => {
    // Update local state when scroll status changes
    if (scrolledToEnd !== hasScrolledToEnd) {
      setHasScrolledToEnd(scrolledToEnd);
    }

    return (
      <div className="space-y-3">
        {checkboxLabel && (
          <Text className="text-center text-sm leading-none text-white/50 md:leading-tight">
            {checkboxLabel}
          </Text>
        )}
        <div className="flex items-center">
          <Checkbox
            id="termsCheckbox"
            disabled={!scrolledToEnd}
            checked={isTermsChecked}
            onCheckedChange={handleTermsCheckboxChange}
            className="mr-2"
          />
          <label htmlFor="termsCheckbox" className="text-text ml-2 text-sm leading-none md:leading-tight">
            <TermsMarkdownRenderer className="pb-0" markdown={termsLabel} />
          </label>
        </div>
        <div className="flex items-center">
          <Checkbox
            id="privacyCheckbox"
            disabled={!scrolledToEnd}
            checked={isPrivacyChecked}
            onCheckedChange={handlePrivacyCheckboxChange}
            className="mr-2"
          />
          <label htmlFor="privacyCheckbox" className="text-text ml-2 text-sm leading-none md:leading-tight">
            <TermsMarkdownRenderer className="pb-0" markdown={privacyLabel} />
          </label>
        </div>
      </div>
    );
  };

  return (
    <TermsDialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={t`Chatbot Terms of Service`}
      content={termsContent ? <TermsMarkdownRenderer markdown={termsContent} /> : null}
      termsVersion={termsVersion}
      error={error}
      isLoading={isLoading}
      onAccept={
        termsLoadedSuccessfully
          ? () => {
              closedByAcceptRef.current = true;
              onAccept();
            }
          : () => {}
      }
      onDecline={onDecline}
      acceptButtonText={termsLoadedSuccessfully ? getButtonText() : undefined}
      declineButtonText={termsLoadedSuccessfully ? t`I Decline` : t`Close`}
      acceptButtonDisabled={!isTermsChecked || !isPrivacyChecked}
      additionalContent={termsLoadedSuccessfully ? checkboxContent : undefined}
      showScrollInstruction={termsLoadedSuccessfully}
      scrollInstructionText={t`Please scroll to the bottom and read the entire terms; the checkbox will become enabled afterward.`}
    />
  );
};
