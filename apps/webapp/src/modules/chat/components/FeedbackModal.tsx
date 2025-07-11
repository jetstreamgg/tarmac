import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text, Heading } from '@/modules/layout/components/Typography';
import { VStack } from '@/modules/layout/components/VStack';
import { HStack } from '@/modules/layout/components/HStack';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (topics: string[]) => void;
}

export const FeedbackModal = ({ isOpen, onClose, onSubmit }: FeedbackModalProps) => {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedTopics([]);
    }
  }, [isOpen]);

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

  const handleSubmit = () => {
    if (selectedTopics.length > 0) {
      onSubmit(selectedTopics);
      setSelectedTopics([]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-containerDark max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            <Heading>
              <Trans>Select Feedback Topics</Trans>
            </Heading>
          </DialogTitle>
        </DialogHeader>
        <VStack className="gap-3 py-4">
          <Text variant="large" className="text-text">
            <Trans>Please select one or more topics that describe your feedback:</Trans>
          </Text>
          <VStack className="mt-4 gap-2">
            {FEEDBACK_TOPICS.map(topic => (
              <HStack
                key={topic.id}
                className={`cursor-pointer items-center rounded-lg border border-violet-200/20 p-3 transition-all ${
                  selectedTopics.includes(topic.id)
                    ? 'bg-violet-200/10'
                    : 'hover:border-violet-200/40 hover:bg-violet-200/5'
                }`}
                onClick={() => handleTopicToggle(topic.id)}
              >
                <Checkbox id={topic.id} checked={selectedTopics.includes(topic.id)} className="mr-3" />
                <VStack className="gap-0.5">
                  <Text
                    variant="medium"
                    className={selectedTopics.includes(topic.id) ? 'text-text' : 'text-violet-200'}
                  >
                    {topic.id.toUpperCase()}
                  </Text>
                  <Text variant="small" className="text-violet-200/70">
                    {topic.label}
                  </Text>
                </VStack>
              </HStack>
            ))}
          </VStack>
          <HStack className="mt-4 justify-end gap-2">
            <Button variant="ghost" onClick={onClose} className="text-violet-200/70 hover:text-white">
              <Trans>Cancel</Trans>
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={selectedTopics.length === 0}>
              <Trans>Continue</Trans>
            </Button>
          </HStack>
        </VStack>
      </DialogContent>
    </Dialog>
  );
};
