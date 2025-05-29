import { useAccount, useChainId } from 'wagmi';
import { MutationFunction, useMutation } from '@tanstack/react-query';
import { SendMessageRequest, SendMessageResponse, ChatIntent } from '../types/Chat';
import { useChatContext } from '../context/ChatContext';
import { CHATBOT_NAME, MessageType, UserType } from '../constants';
import { generateUUID } from '../lib/generateUUID';
import { t } from '@lingui/macro';
import { chainIdNameMapping, isChatIntentAllowed, processNetworkNameInUrl } from '../lib/intentUtils';
import { CHATBOT_DOMAIN, CHATBOT_ENABLED, MAX_HISTORY_LENGTH } from '@/lib/constants';

interface ChatbotResponse {
  chatResponse: {
    response: string;
  };
  actionIntentResponse: Pick<ChatIntent, 'title' | 'url'>[];
}

const fetchEndpoints = async (messagePayload: Partial<SendMessageRequest>) => {
  const response = await fetch(`${CHATBOT_DOMAIN}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messagePayload)
  });

  if (!response.ok) {
    throw new Error('Advanced chat response was not ok');
  }

  const data = await response.json();

  // Transform the advanced response to match the simple mode structure
  return {
    chatResponse: {
      response: data?.response || ''
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
  const data: SendMessageResponse = { ...chatResponse };

  data.intents = actionIntentResponse.map(action => ({
    title: action.title,
    url: action.url,
    intent_id: action.title
  }));

  return data;
};

export const useSendMessage = () => {
  const { setChatHistory, sessionId, chatHistory } = useChatContext();
  const chainId = useChainId();
  const { isConnected } = useAccount();

  const { loading: LOADING, error: ERROR, canceled: CANCELED } = MessageType;
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
          accepted_terms_hash: 'aaaaaaaa11111111bbbbbbbb22222222cccccccc33333333dddddddd44444444', // TODO, this is hardcoded for now
          network,
          messages: [...history.slice(-MAX_HISTORY_LENGTH), { role: 'user', content: message }]
        }
      },
      {
        onSuccess: data => {
          const intents = data.intents
            ?.filter(chatIntent => isChatIntentAllowed(chatIntent, chainId))
            .map(intent => ({ ...intent, url: processNetworkNameInUrl(intent.url) }));

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
        onError: error => {
          console.error('Failed to send message:', error);
          setChatHistory(prevHistory => {
            return prevHistory[prevHistory.length - 1].type === CANCELED
              ? prevHistory
              : [
                  ...prevHistory.filter(item => item.type !== LOADING),
                  {
                    id: generateUUID(),
                    user: UserType.bot,
                    message: t`Sorry, something went wrong. Can you repeat your question?`,
                    type: ERROR
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
