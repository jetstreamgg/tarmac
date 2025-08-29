import React from 'react';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/modules/layout/components/Typography';
import { useInView } from 'react-intersection-observer';
import { LoadingSpinner } from './LoadingSpinner';

interface TermsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  content: React.ReactNode;
  termsVersion?: string;
  error?: string | null;
  isLoading?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  acceptButtonText?: string | ((hasScrolledToEnd: boolean) => string);
  declineButtonText?: string;
  acceptButtonDisabled?: boolean;
  additionalContent?: React.ReactNode | ((hasScrolledToEnd: boolean) => React.ReactNode);
  showScrollInstruction?: boolean;
  scrollInstructionText?: React.ReactNode;
  hideScrollTracking?: boolean;
  customError?: React.ReactNode;
  triggerButton?: React.ReactNode;
  showLoadingState?: boolean;
  loadingContent?: React.ReactNode;
}

export const TermsDialog: React.FC<TermsDialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  content,
  termsVersion,
  error,
  isLoading = false,
  onAccept,
  onDecline,
  acceptButtonText = 'Accept',
  declineButtonText = 'Decline',
  acceptButtonDisabled = false,
  additionalContent,
  showScrollInstruction = true,
  scrollInstructionText,
  hideScrollTracking = false,
  customError,
  triggerButton,
  showLoadingState = false,
  loadingContent
}) => {
  const [endOfTermsRef, hasScrolledToEnd] = useInView({ triggerOnce: true });

  const scrollConditionMet = hideScrollTracking || hasScrolledToEnd;

  const handleAccept = () => {
    if (!acceptButtonDisabled && scrollConditionMet) {
      onAccept();
    }
  };

  const dialogContent = showLoadingState ? (
    <DialogContent className="bg-containerDark max-w-[300px]">
      {loadingContent || (
        <div className="flex items-center justify-center p-4">
          <DialogTitle asChild>
            <Text className="text-text mr-2 text-center">
              <Trans>Please wait...</Trans>
            </Text>
          </DialogTitle>
          <LoadingSpinner />
        </div>
      )}
    </DialogContent>
  ) : (
    <DialogContent className="bg-containerDark max-h-[95dvh] overflow-y-auto">
      <DialogTitle asChild>
        <Text className="text-text text-center text-[26px] sm:text-[28px] md:text-[32px]">{title}</Text>
      </DialogTitle>

      <Card className="scrollbar-thin mx-auto max-h-[256px] w-full overflow-y-auto bg-[#181720] p-3 sm:max-h-[432px] sm:p-4">
        {content}
        <div ref={endOfTermsRef} data-testid="end-of-terms" />
      </Card>

      {showScrollInstruction && (
        <Text className="text-center text-sm leading-none text-white/50 md:leading-tight">
          {scrollInstructionText || (
            <Trans>
              Please scroll to the bottom and read the entire terms; the accept button will become enabled
              afterward.
            </Trans>
          )}
        </Text>
      )}

      {termsVersion && (
        <Text className="text-center text-xs text-white/50">
          <Trans>Terms version: {termsVersion}</Trans>
        </Text>
      )}

      {typeof additionalContent === 'function' ? additionalContent(hasScrolledToEnd) : additionalContent}

      {(error || customError) &&
        (customError || (
          <Text className="text-error mb-4 text-center text-sm leading-none md:leading-tight">{error}</Text>
        ))}

      <div className="flex w-full justify-between gap-4 sm:mt-0 sm:w-auto">
        <Button
          variant="secondary"
          className="flex-1 border bg-transparent hover:bg-[rgb(17,16,31)] active:bg-[rgb(34,32,66)]"
          onClick={onDecline}
          disabled={isLoading}
        >
          <Text>
            <Trans>{declineButtonText}</Trans>
          </Text>
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleAccept}
          disabled={isLoading || !scrollConditionMet || acceptButtonDisabled}
        >
          <Text>
            <Trans>
              {isLoading
                ? 'Processing...'
                : typeof acceptButtonText === 'function'
                  ? acceptButtonText(hasScrolledToEnd)
                  : acceptButtonText}
            </Trans>
          </Text>
        </Button>
      </div>
    </DialogContent>
  );

  const dialog = (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      {dialogContent}
    </Dialog>
  );

  return dialog;
};
