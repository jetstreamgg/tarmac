import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Text, Heading } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

// Feature flag for showing optional comment field
const SHOW_COMMENT_FIELD = false;

interface ConversationFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: 'positive' | 'negative', comment: string | null) => Promise<void>;
  initialRating?: 'positive' | 'negative';
}

export const ConversationFeedbackModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialRating
}: ConversationFeedbackModalProps) => {
  const [rating, setRating] = useState<'positive' | 'negative' | null>(initialRating || null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRating(initialRating || null);
      setComment('');
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, initialRating]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 150)}px`;
    }
  }, [comment]);

  const handleSubmit = async () => {
    if (rating && !isSubmitting) {
      setIsSubmitting(true);
      setError(null);
      try {
        await onSubmit(rating, comment.trim() || null);
        // Only close and reset on success
        setRating(null);
        setComment('');
        onClose();
      } catch (err) {
        // Show error in modal, keep it open for retry
        console.error('Failed to submit feedback:', err);
        setError('Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const isSubmitDisabled = !rating || isSubmitting;

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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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

            {/* Optional Comment Field - Hidden for now, can be re-enabled by setting SHOW_COMMENT_FIELD to true */}
            {SHOW_COMMENT_FIELD && (
              <VStack className="gap-2">
                <Text variant="medium" className="text-xs text-violet-200/90 sm:text-sm">
                  <Trans>Additional comments (optional):</Trans>
                </Text>
                <textarea
                  ref={textareaRef}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  disabled={isSubmitting}
                  placeholder={t`Share any additional thoughts...`}
                  className="scrollbar-thin max-h-[150px] min-h-[60px] w-full resize-none rounded-lg border border-violet-200/20 bg-transparent p-2 text-xs leading-5 text-white placeholder:text-violet-200/50 focus:border-violet-200/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:p-3 sm:text-sm"
                  rows={3}
                />
              </VStack>
            )}
          </VStack>

          {/* Error Message */}
          {error && (
            <HStack className="items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
              <Text variant="small" className="text-red-400">
                {error}
              </Text>
            </HStack>
          )}

          <HStack className="justify-end gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-violet-200/70 hover:text-white"
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitDisabled}>
              {isSubmitting ? <Trans>Submitting...</Trans> : <Trans>Submit</Trans>}
            </Button>
          </HStack>
        </VStack>
      </DialogContent>
    </Dialog>
  );
};
