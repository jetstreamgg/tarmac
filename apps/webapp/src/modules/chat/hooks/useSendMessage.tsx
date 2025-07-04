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
    body: JSON.stringify(messagePayload)
    // credentials: 'include' // Important for cookies - Uncomment when we have a backend with jwt
  });

  if (!response.ok) {
    // Check for 403 specifically to handle terms acceptance
    if (response.status === 403) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // If Requestly or another interceptor doesn't provide JSON body
        errorData = { error: 'Terms acceptance required' };
      }
      const error = new Error(errorData.error || 'Terms acceptance required');
      (error as any).code = errorData.code || 'TERMS_NOT_ACCEPTED';
      (error as any).status = 403;
      throw error;
    }
    // Preserve status for other errors too
    const error = new Error(`Chat response was not ok: ${response.status}`);
    (error as any).status = response.status;
    throw error;
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
  const {
    setChatHistory,
    sessionId,
    chatHistory,
    setShowChatbotTermsDialog,
    setHasAcceptedChatbotTerms,
    setPendingMessage
  } = useChatContext();
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
          console.log('Error details:', {
            status: (error as any).status,
            code: (error as any).code,
            message: error.message
          });

          // Handle 403 errors specifically for terms acceptance
          // Check both status property and error message (for Requestly compatibility)
          const is403Error = (error as any).status === 403;
          if (is403Error) {
            console.log('Handling 403 error - showing terms dialog');

            // Clear terms acceptance state
            setHasAcceptedChatbotTerms(false);

            // Show terms dialog
            setShowChatbotTermsDialog(true);

            // Store the message that triggered the 403
            setPendingMessage(message);

            // Remove both the user message and loading message
            // We need to remove the last 2 messages (user message + loading)
            setChatHistory(prevHistory => {
              const filtered = prevHistory.filter(item => item.type !== LOADING);
              // Remove the last message (which should be the user's message that got 403)
              return filtered.slice(0, -1);
            });

            return;
          }

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
