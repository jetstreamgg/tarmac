import { useAccount, useChainId } from 'wagmi';
import { MutationFunction, useMutation } from '@tanstack/react-query';
import { SendMessageRequest, SendMessageResponse, ChatIntent } from '../types/Chat';
import { useChatContext } from '../context/ChatContext';
import { CHATBOT_NAME, MessageType, UserType, TERMS_ACCEPTANCE_MESSAGE } from '../constants';
import { generateUUID } from '../lib/generateUUID';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  chainIdNameMapping,
  isChatIntentAllowed,
  processNetworkNameInUrl,
  ensureIntentHasNetwork
} from '../lib/intentUtils';
import { CHATBOT_DOMAIN, CHATBOT_ENABLED, MAX_HISTORY_LENGTH } from '@/lib/constants';

interface ChatbotResponse {
  chatResponse: {
    response: string;
    knowledge_date?: string;
  };
  actionIntentResponse: Pick<ChatIntent, 'title' | 'url' | 'priority'>[];
}

const fetchEndpoints = async (messagePayload: Partial<SendMessageRequest>) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  // Add auth-related headers if environment variables are present
  // Should not exist in production, values would be visible in client
  const cfAccessClientId = import.meta.env.VITE_CHATBOT_CF_ACCESS_CLIENT_ID;
  const cfAccessClientSecret = import.meta.env.VITE_CHATBOT_CF_ACCESS_CLIENT_SECRET;

  if (cfAccessClientId && cfAccessClientSecret) {
    headers['CF-Access-Client-Id'] = cfAccessClientId;
    headers['CF-Access-Client-Secret'] = cfAccessClientSecret;
  }

  const response = await fetch(`${CHATBOT_DOMAIN}/chat`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(messagePayload)
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      const error: any = new Error('Terms acceptance required');
      error.code = 'TERMS_NOT_ACCEPTED';
      error.status = response.status;
      throw error;
    }
    throw new Error('Advanced chat response was not ok');
  }

  const data = await response.json();

  // Transform the advanced response to match the simple mode structure
  return {
    chatResponse: {
      response: data?.response || '',
      knowledge_date: data?.knowledge_date
    },
    actionIntentResponse: data?.actions || []
  } as ChatbotResponse;
};

const sendMessageMutation: MutationFunction<
  SendMessageResponse,
  { messagePayload: Partial<SendMessageRequest> }
> = async ({ messagePayload }) => {
  if (!CHATBOT_ENABLED) {
    throw new Error(`${CHATBOT_NAME} is disabled`);
  }

  const { chatResponse, actionIntentResponse } = await fetchEndpoints(messagePayload);

  if (!chatResponse.response) {
    throw new Error('Chatbot did not respond');
  }
  // initally set data to the chat response
  // we will override the response if we detect an action intent
  const data: SendMessageResponse = {
    response: chatResponse.response,
    knowledge_date: chatResponse.knowledge_date
  };

  data.intents = actionIntentResponse
    .map(action => {
      // Extract widget parameter from the action URL to use as intent_id
      let widget = '';
      try {
        const urlObj = new URL(action.url, window.location.origin);
        const widgetParam = urlObj.searchParams.get('widget');
        if (widgetParam) {
          widget = widgetParam;
        }
      } catch {
        // If URL parsing fails, widget remains empty string
      }

      return {
        title: action.title,
        url: action.url,
        intent_id: action.title,
        widget,
        priority: action.priority ?? 9999 // Default to 9999 if priority is missing
      };
    })
    .sort((a, b) => a.priority - b.priority); // Sort by priority (lower numbers first)

  return data;
};

export const useSendMessage = () => {
  const { setChatHistory, sessionId, chatHistory, setTermsAccepted, setKnowledgeDate } = useChatContext();
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { i18n } = useLingui();

  const { loading: LOADING, error: ERROR, canceled: CANCELED, authError: AUTH_ERROR } = MessageType;
  const { mutate } = useMutation<SendMessageResponse, Error, { messagePayload: Partial<SendMessageRequest> }>(
    {
      mutationFn: sendMessageMutation
    }
  );

  const history = chatHistory
    .filter(record => record.type !== CANCELED)
    .map(record => ({
      content: record.message,
      role: record.user === UserType.user ? 'user' : 'assistant'
    }));
  const network = isConnected ? chainIdNameMapping[chainId as keyof typeof chainIdNameMapping] : 'ethereum';

  const sendMessage = (message: string) => {
    mutate(
      {
        messagePayload: {
          session_id: sessionId,
          network,
          messages: [...history.slice(-MAX_HISTORY_LENGTH), { role: 'user', content: message }]
        }
      },
      {
        onSuccess: data => {
          const intents = data.intents
            ?.filter(chatIntent => isChatIntentAllowed(chatIntent))
            .map(intent => {
              const processedUrl = processNetworkNameInUrl(intent.url);
              const urlWithNetwork = ensureIntentHasNetwork(processedUrl, chainId);
              return { ...intent, url: urlWithNetwork };
            });

          // Update knowledge date if provided
          if (data.knowledge_date) {
            setKnowledgeDate(data.knowledge_date);
          }

          setChatHistory(prevHistory => {
            return prevHistory[prevHistory.length - 1].type === CANCELED
              ? prevHistory
              : [
                  ...prevHistory.filter(item => item.type !== LOADING),
                  {
                    id: generateUUID(),
                    user: UserType.bot,
                    message: data.response,
                    intents
                  }
                ];
          });
        },
        onError: async (error: any) => {
          console.error('Failed to send message:', JSON.stringify(error));
          if (error.status === 401) {
            setTermsAccepted(false);
          }
          setChatHistory(prevHistory => {
            return prevHistory[prevHistory.length - 1].type === CANCELED
              ? prevHistory
              : [
                  ...prevHistory.filter(item => item.type !== LOADING),
                  {
                    id: generateUUID(),
                    user: UserType.bot,
                    message:
                      error.status === 401
                        ? i18n._(TERMS_ACCEPTANCE_MESSAGE)
                        : t`Sorry, something went wrong. Can you repeat your question?`,
                    type: error.status === 401 ? AUTH_ERROR : ERROR
                  }
                ];
          });
        }
      }
    );

    setChatHistory(prevHistory => [
      ...prevHistory,
      { id: generateUUID(), user: UserType.user, message },
      { id: generateUUID(), user: UserType.bot, message: t`typing...`, type: LOADING }
    ]);
  };

  return { sendMessage };
};
