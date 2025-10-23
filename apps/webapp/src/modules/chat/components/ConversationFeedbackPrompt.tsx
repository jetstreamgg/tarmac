import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { HStack } from '@/modules/layout/components/HStack';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';

interface ConversationFeedbackPromptProps {
  onRatingClick: (rating: 'positive' | 'negative') => void;
  disabled?: boolean;
}

export const ConversationFeedbackPrompt = ({
  onRatingClick,
  disabled = false
}: ConversationFeedbackPromptProps) => {
  return (
    <HStack className="items-center justify-center gap-2 opacity-60">
      <Text variant="small" className={`text-[13px] ${disabled ? 'text-gray-600' : 'text-violet-200'}`}>
        <Trans>Rate this conversation:</Trans>
      </Text>
      <HStack gap={1}>
        <Button
          onClick={() => onRatingClick('positive')}
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600"
          aria-label="Good conversation"
          disabled={disabled}
        >
          <ThumbsUp size={18} />
        </Button>
        <Button
          onClick={() => onRatingClick('negative')}
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-200 disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600"
          aria-label="Bad conversation"
          disabled={disabled}
        >
          <ThumbsDown size={18} />
        </Button>
      </HStack>
    </HStack>
  );
};
