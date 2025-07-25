import React, { useState, useEffect } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { TermsDialog } from '@/modules/ui/components/TermsDialog';
import { TermsMarkdownRenderer } from '@/modules/ui/components/markdown/TermsMarkdownRenderer';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckedState } from '@radix-ui/react-checkbox';

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
  const [isChecked, setIsChecked] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setHasScrolledToEnd(false);
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onDecline();
    }
  };

  const handleCheckboxChange = (checkedState: CheckedState) => {
    setIsChecked(checkedState === true);
  };

  // Compute button text based on state
  const getButtonText = () => {
    if (isLoading) return t`Accepting...`;
    if (!hasScrolledToEnd) return t`Scroll down ↓`;
    if (!isChecked) return t`Check to continue`;
    return t`Accept`;
  };

  const checkboxContent = (scrolledToEnd: boolean) => {
    // Update local state when scroll status changes
    if (scrolledToEnd !== hasScrolledToEnd) {
      setHasScrolledToEnd(scrolledToEnd);
    }

    return (
      <div className="flex items-center sm:my-4">
        <Checkbox
          id="chatbotTermsCheckbox"
          disabled={!scrolledToEnd}
          checked={isChecked}
          onCheckedChange={handleCheckboxChange}
          className="mr-2"
        />
        <label
          htmlFor="chatbotTermsCheckbox"
          className="text-text ml-2 text-sm leading-none md:leading-tight"
        >
          <Trans>By clicking accept, you confirm agreement to the Chatbot Terms of Use.</Trans>
        </label>
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
      onAccept={termsLoadedSuccessfully ? onAccept : () => {}}
      onDecline={onDecline}
      acceptButtonText={termsLoadedSuccessfully ? getButtonText() : undefined}
      declineButtonText={termsLoadedSuccessfully ? t`Reject` : t`Close`}
      acceptButtonDisabled={!isChecked}
      additionalContent={termsLoadedSuccessfully ? checkboxContent : undefined}
      showScrollInstruction={termsLoadedSuccessfully}
      scrollInstructionText={t`Please scroll to the bottom and read the entire terms; the checkbox will become enabled afterward.`}
    />
  );
};
