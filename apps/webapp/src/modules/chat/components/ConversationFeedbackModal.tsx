import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Text, Heading } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';

interface ConversationFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: 'positive' | 'negative') => void;
  initialRating?: 'positive' | 'negative';
}

export const ConversationFeedbackModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialRating
}: ConversationFeedbackModalProps) => {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(initialRating || null);

  useEffect(() => {
    if (isOpen) {
      setRating(initialRating || null);
    }
  }, [isOpen, initialRating]);

  const handleSubmit = () => {
    if (rating) {
      onSubmit(rating);
      setRating(null);
      onClose();
    }
  };

  const isSubmitDisabled = !rating;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-containerDark max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            <Heading>
              <Trans>Rate This Conversation</Trans>
            </Heading>
          </DialogTitle>
        </DialogHeader>
        <VStack className="gap-4 py-3 sm:gap-5 sm:py-4">
          <VStack className="gap-3">
            <Text variant="medium" className="text-center text-xs text-violet-200 sm:text-sm">
              <Trans>How would you rate your overall experience with this conversation?</Trans>
            </Text>
            <VStack className="gap-2">
              <HStack className="justify-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setRating('positive')}
                  className={`flex h-14 w-24 items-center justify-center gap-2 transition-all ${
                    rating === 'positive'
                      ? 'border-brandLight bg-brandLight/10 hover:bg-brandLight/20 border-[1.5px] text-white shadow-md shadow-violet-500/50'
                      : 'hover:bg-gray-750 border border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <ThumbsUp size={24} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setRating('negative')}
                  className={`flex h-14 w-24 items-center justify-center gap-2 transition-all ${
                    rating === 'negative'
                      ? 'border-brandLight bg-brandLight/10 hover:bg-brandLight/20 border-[1.5px] text-white shadow-md shadow-violet-500/50'
                      : 'hover:bg-gray-750 border border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <ThumbsDown size={24} />
                </Button>
              </HStack>
              {rating && (
                <Text variant="small" className="mt-2 text-center text-xs text-violet-200/80">
                  <Trans>
                    Your selection: {rating === 'positive' ? 'Overall positive' : 'Overall negative'}
                  </Trans>
                </Text>
              )}
            </VStack>
          </VStack>

          <HStack className="justify-end gap-2">
            <Button variant="ghost" onClick={onClose} className="text-violet-200/70 hover:text-white">
              <Trans>Cancel</Trans>
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitDisabled}>
              <Trans>Submit</Trans>
            </Button>
          </HStack>
        </VStack>
      </DialogContent>
    </Dialog>
  );
};
