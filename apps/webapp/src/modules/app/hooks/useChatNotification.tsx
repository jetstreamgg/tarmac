import { toast, useToast } from '@/components/ui/use-toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text } from '@/modules/layout/components/Typography';
import { HStack } from '@/modules/layout/components/HStack';
import { VStack } from '@/modules/layout/components/VStack';
import { Trans } from '@lingui/react/macro';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';
import { CHATBOT_ENABLED, QueryParams, CHAT_NOTIFICATION_KEY } from '@/lib/constants';
import { CHATBOT_NAME } from '@/modules/chat/constants';
import { Chat } from '@/modules/icons';

export const useChatNotification = (isAuthorized: boolean) => {
  const { dismiss } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bpi } = useBreakpointIndex();

  // Use localStorage directly for notification state
  const [chatSuggested, setChatSuggested] = useState(() => {
    return localStorage.getItem(CHAT_NOTIFICATION_KEY) === 'true';
  });

  const showChat = useMemo(() => CHATBOT_ENABLED && isAuthorized, [CHATBOT_ENABLED, isAuthorized]);

  const onClickChat = useCallback(() => {
    searchParams.set(QueryParams.Chat, 'true');
    if (bpi < BP['3xl']) searchParams.set(QueryParams.Details, 'false');
    setSearchParams(searchParams);
    setTimeout(() => {
      dismiss();
    }, 300);
  }, [bpi, dismiss, searchParams, setSearchParams]);

  const onClose = useCallback(() => {
    localStorage.setItem(CHAT_NOTIFICATION_KEY, 'true');
    setChatSuggested(true);
  }, []);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only show if authorized by the notification queue
    if (!isAuthorized) {
      dismiss();
      return;
    }

    if (showChat) {
      timerRef.current = setTimeout(() => {
        if (!chatSuggested && searchParams.get(QueryParams.Chat) !== 'true') {
          toast({
            title: (
              <HStack>
                <img
                  src="/images/chatbot_logo.svg"
                  alt={`${CHATBOT_NAME} avatar`}
                  className="@2xl/chat:h-8 @2xl/chat:w-8 h-5 w-5"
                />
                <Text variant="medium" className="text-selectActive ml-1">
                  {CHATBOT_NAME}
                </Text>
              </HStack>
            ),
            description: (
              <HStack className="ml-1 w-full justify-between">
                <VStack className="mt-4">
                  <Text variant="medium">
                    <Trans>Hi, {CHATBOT_NAME} here!</Trans>
                  </Text>
                  <Text variant="medium">
                    <Trans>How can I help you today?</Trans>
                  </Text>
                </VStack>
                <Button className="place-self-end" variant="pill" size="xs" onClick={onClickChat}>
                  <Chat width={16} height={16} className="mr-1" />
                  <Trans>Start Chatting</Trans>
                </Button>
              </HStack>
            ),
            variant: 'chat',
            duration: Infinity,
            onClose
          });
        }
      }, 5000);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showChat, chatSuggested, searchParams, isAuthorized]);
};
