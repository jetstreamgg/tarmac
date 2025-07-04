import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { LoadingSpinner } from '@/modules/ui/components/LoadingSpinner';
import { useInView } from 'react-intersection-observer';
import { Checkbox } from '@/components/ui/checkbox';
import { acceptChatbotTerms, getChatbotTerms } from '../api/chatbotTermsApi';
import { AcceptTermsResponse } from '../types/chatbotTerms';

interface ChatbotTermsDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ChatbotTermsDialog({ isOpen, onAccept, onDecline }: ChatbotTermsDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsContent, setTermsContent] = useState<string>('');
  const [termsVersion, setTermsVersion] = useState<string>('');
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isTermsChecked, setIsTermsChecked] = useState(false);
  const [isPrivacyChecked, setIsPrivacyChecked] = useState(false);
  const { ref: endOfTermsRef, inView } = useInView({
    threshold: 0.9, // Require 90% of the element to be visible
    skip: !isOpen || !termsContent // Don't observe when dialog is closed or no content
  });

  useEffect(() => {
    if (inView) {
      setHasScrolledToEnd(true);
    }
  }, [inView]);

  useEffect(() => {
    if (isOpen) {
      loadTerms();
      // Reset states when dialog opens
      setHasScrolledToEnd(false);
      setIsTermsChecked(false);
      setIsPrivacyChecked(false);
    }
  }, [isOpen]);

  const loadTerms = async () => {
    try {
      const { content, version } = await getChatbotTerms();
      setTermsContent(content);
      setTermsVersion(version);
      // Check if content is immediately visible after a small delay
      setTimeout(() => {
        if (inView) {
          setHasScrolledToEnd(true);
        }
      }, 100);
    } catch (err) {
      console.error('Failed to load terms:', err);
      setTermsContent('Failed to load terms. Please try again later.');
    }
  };

  const handleAccept = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response: AcceptTermsResponse = await acceptChatbotTerms({
        termsVersion
      });

      if (response.success) {
        onAccept();
      }
    } catch (err: any) {
      console.error('Failed to accept terms:', err);

      // Handle specific error cases
      if (err.status === 429) {
        setError('Too many attempts. Please try again later.');
      } else if (err.status === 400 && err.currentVersion) {
        setError('Terms version mismatch. Please refresh the page.');
      } else {
        setError('Failed to accept terms. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      setHasScrolledToEnd(false);
      setIsTermsChecked(false);
      setIsPrivacyChecked(false);
      onDecline();
    }
  };

  const canAccept = hasScrolledToEnd && isTermsChecked && isPrivacyChecked;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-containerDark max-h-[95dvh] overflow-y-auto">
        <DialogTitle asChild>
          <Text className="text-text text-center text-[26px] sm:text-[28px] md:text-[32px]">
            <Trans>Chatbot Terms of Service</Trans>
          </Text>
        </DialogTitle>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <Card className="scrollbar-thin mx-auto max-h-[400px] w-full overflow-y-auto bg-[#181720] p-4 sm:max-h-[500px]">
              <Text className="text-text/80 whitespace-pre-wrap text-sm">{termsContent}</Text>
              <div ref={endOfTermsRef} className="h-1" />
            </Card>

            <Text className="text-center text-sm leading-none text-white/50 md:leading-tight">
              {!hasScrolledToEnd ? (
                <Trans>Please scroll to the bottom to read all terms before proceeding.</Trans>
              ) : !isTermsChecked || !isPrivacyChecked ? (
                <Trans>Please check both boxes to confirm your agreement.</Trans>
              ) : (
                <Trans>You may now accept the terms.</Trans>
              )}
            </Text>

            {hasScrolledToEnd && (
              <div className="space-y-3">
                <Text className="mb-2 text-sm text-white/80">
                  <Trans>
                    By checking the boxes below, you confirm that you have read, understood, and agree to the
                    following:
                  </Trans>
                </Text>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms-checkbox"
                    checked={isTermsChecked}
                    onCheckedChange={checked => setIsTermsChecked(checked === true)}
                    className="mt-1"
                  />
                  <label htmlFor="terms-checkbox" className="cursor-pointer text-sm text-white/70">
                    <Trans>
                      The Terms of Use of the chatbot service, including that you are at least 18 years old
                    </Trans>
                  </label>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="privacy-checkbox"
                    checked={isPrivacyChecked}
                    onCheckedChange={checked => setIsPrivacyChecked(checked === true)}
                    className="mt-1"
                  />
                  <label htmlFor="privacy-checkbox" className="cursor-pointer text-sm text-white/70">
                    <Trans>The Privacy Policy governing the use of this chatbot service</Trans>
                  </label>
                </div>
              </div>
            )}

            {error && <Text className="text-error text-center text-sm">{error}</Text>}

            <div className="flex w-full justify-between gap-4">
              <DialogClose asChild>
                <Button
                  variant="secondary"
                  className="flex-1 border bg-transparent hover:bg-[rgb(17,16,31)] active:bg-[rgb(34,32,66)]"
                  onClick={onDecline}
                  disabled={isLoading}
                >
                  <Text>
                    <Trans>Decline</Trans>
                  </Text>
                </Button>
              </DialogClose>
              <Button
                variant="primary"
                className={`flex-1 ${!canAccept ? 'cursor-not-allowed opacity-50' : ''}`}
                onClick={handleAccept}
                disabled={!canAccept || isLoading}
              >
                <Text>
                  <Trans>
                    {isLoading ? 'Accepting...' : canAccept ? 'I Agree' : 'Complete Requirements'}
                  </Trans>
                </Text>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
