import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { CHATBOT_NAME, MessageType, UserType } from '../constants';
import { Text } from '@/modules/layout/components/Typography';
import { useAccount } from 'wagmi';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { useSearchParams } from 'react-router-dom';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { QueryParams } from '@/lib/constants';
import { motion } from 'framer-motion';
import { ResponseModifierRow } from './ResponseModifierRow';
import { t } from '@lingui/macro';
import { ChatIntent } from '../types/Chat';
import { ChatIntentsRow } from './ChatIntentsRow';
import { StopGeneratingButton } from './StopGeneratingButton';
import { ChatError } from '@/modules/icons';
import { ChatMarkdownRenderer } from '@/modules/ui/components/markdown/ChatMarkdownRenderer';

type ChatBubbleProps = {
  user: UserType;
  message: string;
  type?: MessageType;
  isLastMessage?: boolean;
  isFirstMessage?: boolean;
  intents?: ChatIntent[];
  sendMessage: (message: string) => void;
  showModifierRow?: boolean;
};

const TypingIndicator: React.FC<{ text?: string }> = ({ text = '' }) => {
  const dotVariants = {
    start: { y: '0%' },
    animate: { y: ['0%', '-120%', '0%'] }
  };

  const transition = {
    duration: '0.8',
    repeat: Infinity,
    repeatType: 'loop' as const,
    repeatDelay: 0.3,
    ease: 'easeInOut'
  };

  const dotClasses = 'mx-[2px] mb-[5px] h-[5px] w-[5px] rounded-full bg-white/75';

  return (
    <HStack gap={2} className="items-end">
      <Text className="text-white/75">{text || t`Typing`}</Text>
      <div className="flex items-center">
        {[0.1, 0.2, 0.3].map((delay, index) => (
          <motion.div
            key={index}
            className={dotClasses}
            variants={dotVariants}
            animate="animate"
            transition={{ ...transition, delay }}
          />
        ))}
      </div>
    </HStack>
  );
};

export const ChatBubble = ({
  user,
  message,
  type,
  intents,
  sendMessage,
  showModifierRow = true,
  isLastMessage
}: ChatBubbleProps) => {
  const { address } = useAccount();
  const [searchParams] = useSearchParams();
  const { bpi } = useBreakpointIndex();
  const shouldUseLargeAvatar = bpi >= BP.xl && searchParams.get(QueryParams.Details) !== 'true';
  const isError = type === MessageType.error;
  const isLoading = type === MessageType.loading;
  const isInternal = type === MessageType.internal;
  const isCanceled = type === MessageType.canceled;
  const isPending = type === MessageType.pending;

  return (
    <div
      // The `@2xl/chat` class is used to style elements based on the width of the `@container/chat` container
      className={`@2xl/chat:items-start flex flex-col gap-3 xl:gap-2 ${user === UserType.user ? '@2xl/chat:flex-row-reverse' : 'xl:@2xl/chat:gap-0'}`}
    >
      <HStack
        className={`items-center space-x-2 ${user === UserType.user ? 'xl:@2xl/chat:self-start xl:self-end' : '@2xl/chat:items-start'}`}
      >
        {user === UserType.bot ? (
          <img
            src="/images/chatbot_logo.svg"
            alt={`${CHATBOT_NAME} avatar`}
            className="@2xl/chat:h-8 @2xl/chat:w-8 h-5 w-5"
          />
        ) : (
          <CustomAvatar address={address || 'address-not-connected'} size={shouldUseLargeAvatar ? 32 : 20} />
        )}
        <Text
          variant="medium"
          className={`text-textSecondary block leading-4 ${user === UserType.user ? 'xl:hidden' : ''}`}
        >
          {user}
        </Text>
      </HStack>
      <VStack
        className={`gap-2 ${user === UserType.user ? 'xl:bg-primary xl:w-fit xl:self-end xl:rounded-2xl xl:rounded-tr-[2px] xl:py-3 xl:pl-5 xl:pr-7' : '@2xl/chat:ml-10'}`}
      >
        <Text
          variant="medium"
          className={`text-textSecondary hidden leading-4 ${user === UserType.user ? 'xl:block' : ''}`}
        >
          {user}
        </Text>
        {isLoading ? (
          <div className="space-y-5">
            <TypingIndicator text={t`Let me think`} />
            <StopGeneratingButton />
          </div>
        ) : (
          <div className="space-y-5">
            <HStack className="items-center space-x-[6px]">
              {isError && <ChatError boxSize={16} />}
              <div className={`${isPending ? 'opacity-50' : ''} text-white/75`}>
                <ChatMarkdownRenderer markdown={message} />
                {isPending && <span className="ml-2 text-xs italic">(Pending terms acceptance)</span>}
              </div>
            </HStack>
            {user === UserType.bot && !isError && !isInternal && !isCanceled && (
              <div className="space-y-5">
                {intents && intents?.length > 0 && isLastMessage && <ChatIntentsRow intents={intents} />}
                {showModifierRow && <ResponseModifierRow sendMessage={sendMessage} />}
              </div>
            )}
          </div>
        )}
      </VStack>
    </div>
  );
};
