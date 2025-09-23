import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text, Heading } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { MAX_MESSAGE_LENGTH } from '@/lib/constants';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (topics: string[], message: string) => void;
}

export const FeedbackModal = ({ isOpen, onClose, onSubmit }: FeedbackModalProps) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedTopics([]);
      setStep(1);
      setFeedbackMessage('');
    }
  }, [isOpen]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && step === 2) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [feedbackMessage, step]);

  const FEEDBACK_TOPICS = [
    { id: 'ok', label: t`Response is correct and sufficient` },
    { id: 'wrong', label: t`Response contains wrong information` },
    { id: 'insufficient', label: t`Response omits key information` },
    { id: 'advice', label: t`Response may be perceived as financial, investment, or legal advice` },
    { id: 'disclaimer', label: t`Missing or unnecessary disclaimer` },
    { id: 'problem', label: t`Unexpected issue with the response` },
    { id: 'wrong-action-button', label: t`Missing activation/button for trade, etc.` },
    { id: 'other', label: t`Any feedback not matching above topics` }
  ];
  const handleTopicToggle = (topicId: string) => {
    setSelectedTopics(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const handleContinue = () => {
    if (selectedTopics.length > 0) {
      setStep(2);
      // Focus textarea when moving to step 2
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleSubmit = () => {
    const trimmedMessage = feedbackMessage.trim();
    if (selectedTopics.length > 0 && trimmedMessage) {
      onSubmit(selectedTopics, trimmedMessage);
      setSelectedTopics([]);
      setFeedbackMessage('');
      setStep(1);
      onClose();
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const isSubmitDisabled = step === 1 ? selectedTopics.length === 0 : !feedbackMessage.trim();

  // Calculate the full message length including /feedback prefix and topics
  const fullMessageLength = `/feedback ${selectedTopics.join(',')} - ${feedbackMessage}`.length;
  const remainingChars = MAX_MESSAGE_LENGTH - fullMessageLength;
  const isOverLimit = remainingChars < 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-containerDark max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            <Heading>
              {step === 1 ? <Trans>Select Feedback Topics</Trans> : <Trans>Write Your Feedback</Trans>}
            </Heading>
          </DialogTitle>
        </DialogHeader>
        <VStack className="gap-1 py-2 sm:gap-2 sm:py-3">
          {step === 1 ? (
            <>
              <Text variant="medium" className="text-text text-xs sm:text-sm">
                <Trans>Please select one or more topics that describe your feedback:</Trans>
              </Text>
              <VStack className="scrollbar-thin mt-1 max-h-[40vh] gap-0.5 overflow-y-auto sm:mt-2 sm:gap-1">
                {FEEDBACK_TOPICS.map(topic => (
                  <HStack
                    key={topic.id}
                    className={`cursor-pointer items-center rounded-lg border border-violet-200/20 p-1.5 transition-all sm:p-2 ${
                      selectedTopics.includes(topic.id)
                        ? 'bg-violet-200/10'
                        : 'hover:border-violet-200/40 hover:bg-violet-200/5'
                    }`}
                    onClick={() => handleTopicToggle(topic.id)}
                  >
                    <Checkbox id={topic.id} checked={selectedTopics.includes(topic.id)} className="mr-2" />
                    <VStack className="gap-0">
                      <Text
                        variant="small"
                        className={
                          selectedTopics.includes(topic.id) ? 'text-text font-medium' : 'text-violet-200'
                        }
                      >
                        {topic.id.toUpperCase()}
                      </Text>
                      <Text variant="captionSm" className="text-violet-200/70">
                        {topic.label}
                      </Text>
                    </VStack>
                  </HStack>
                ))}
              </VStack>
            </>
          ) : (
            <>
              <Text variant="large" className="text-text text-sm sm:text-base">
                <Trans>Selected topics: {selectedTopics.map(topic => topic.toUpperCase()).join(', ')}</Trans>
              </Text>
              <Text variant="medium" className="text-xs text-violet-200 sm:text-sm">
                <Trans>Please describe your feedback in detail:</Trans>
              </Text>
              <textarea
                ref={textareaRef}
                value={feedbackMessage}
                onChange={e => setFeedbackMessage(e.target.value)}
                placeholder={t`Type your feedback here...`}
                className="scrollbar-thin mt-2 max-h-[150px] min-h-[80px] w-full resize-none rounded-lg border border-violet-200/20 bg-transparent p-2 text-xs leading-5 text-white placeholder:text-violet-200/50 focus:border-violet-200/40 focus:outline-none sm:max-h-[200px] sm:min-h-[100px] sm:p-3 sm:text-sm"
                rows={4}
              />
              <Text variant="small" className={`text-violet-200/50 ${isOverLimit ? 'text-red-500' : ''}`}>
                {fullMessageLength} / {MAX_MESSAGE_LENGTH}
              </Text>
            </>
          )}
          <HStack className="mt-2 justify-end gap-1 sm:mt-3 sm:gap-2">
            {step === 2 && (
              <Button variant="ghost" onClick={handleBack} className="text-violet-200/70 hover:text-white">
                <Trans>Back</Trans>
              </Button>
            )}
            {step === 1 && (
              <Button variant="ghost" onClick={onClose} className="text-violet-200/70 hover:text-white">
                <Trans>Cancel</Trans>
              </Button>
            )}
            <Button
              variant="primary"
              onClick={step === 1 ? handleContinue : handleSubmit}
              disabled={step === 1 ? isSubmitDisabled : isSubmitDisabled || isOverLimit}
            >
              {step === 1 ? <Trans>Continue</Trans> : <Trans>Send</Trans>}
            </Button>
          </HStack>
        </VStack>
      </DialogContent>
    </Dialog>
  );
};
