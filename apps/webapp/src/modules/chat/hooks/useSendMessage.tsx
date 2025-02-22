import { MutationFunction, useMutation } from '@tanstack/react-query';
import { Recommendation, SendMessageRequest, SendMessageResponse } from '../types/Chat';
import { useChatContext } from '../context/ChatContext';
import {
  CHAT_SUGGESTIONS_ENABLED,
  ADVANCED_CHAT_ENABLED,
  CHATBOT_NAME,
  MessageType,
  UserType
} from '../constants';
import { generateUUID } from '../lib/generateUUID';
import { t } from '@lingui/macro';
import { actionIntentClassificationOptions } from '../lib/intentClassificationOptions';
import { handleActionIntent } from '../lib/handleActionIntent';
import { slotDefinitions } from '../lib/slotDefinitions';
import { useAvailableTokenRewardContracts } from '@jetstreamgg/hooks';
import { useChainId } from 'wagmi';
import {
  generateRandomResponse,
  generateRandomIntent,
  generateRandomRecommendations,
  generateRandomSlots
} from './__mocks__/mock-chat-endpoints';
import { mainnet } from 'wagmi/chains';
import { base } from 'wagmi/chains';
import { arbitrum } from 'wagmi/chains';

const isMocked = true;

const fetchEndpoints = async (messagePayload: Partial<SendMessageRequest>) => {
  const endpoint = import.meta.env.VITE_CHATBOT_ENDPOINT || 'https://staging-api.sky.money';

  // Use mock data in development
  if (isMocked) {
    // Simulate a 2-second network delay
    const delay = 1; // 2000
    await new Promise(resolve => setTimeout(resolve, delay));
    const mockResponses = {
      chatResponse: {
        response: generateRandomResponse(),
        messageId: Math.random().toString(36).substring(7)
      },
      actionIntentResponse: {
        classification: generateRandomIntent(),
        confidence: Math.random()
      },
      questionIntentResponse: {
        recommendations: generateRandomRecommendations()
      },
      slotResponse: {
        slots: generateRandomSlots('TRADE_')
      }
    };

    return Promise.resolve(mockResponses);
  }

  return ADVANCED_CHAT_ENABLED && CHAT_SUGGESTIONS_ENABLED
    ? fetchAdvancedChat(endpoint, messagePayload)
    : fetchSimpleChat(endpoint, messagePayload);
};

const fetchAdvancedChat = async (endpoint: string, messagePayload: Partial<SendMessageRequest>) => {
  const response = await fetch(`${endpoint}/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...messagePayload,
      classification_options: actionIntentClassificationOptions,
      slots: slotDefinitions,
      limit: 4 // for recommendations
    })
  });

  if (!response.ok) {
    throw new Error('Advanced chat response was not ok');
  }

  const data = await response.json();

  // Transform the advanced response to match the simple mode structure
  return {
    chatResponse: {
      response: data.response,
      messageId: data.messageId
    },
    actionIntentResponse: {
      classification: data.classification,
      confidence: data.confidence
    },
    questionIntentResponse: {
      recommendations: data.recommendations
    },
    slotResponse: {
      slots: data.slots
    }
  };
};

const fetchSimpleChat = async (endpoint: string, messagePayload: Partial<SendMessageRequest>) => {
  const chatPromise = fetch(`${endpoint}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messagePayload)
  })
    .then(response => response.json())
    .catch(error => {
      console.error('Failed to fetch chat response:', error);
      throw new Error('Chat response was not ok');
    });

  // Only create these promises if suggestions are enabled
  const [actionIntentPromise, questionIntentPromise, slotPromise] = CHAT_SUGGESTIONS_ENABLED
    ? [
        fetch(`${endpoint}/intent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classification_options: actionIntentClassificationOptions,
            input: messagePayload.message,
            history: messagePayload.history,
            session_id: messagePayload.session_id
          })
        }).then(response => (response.ok ? response.json() : null)),

        fetch(`${endpoint}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: messagePayload.session_id,
            input: messagePayload.message,
            limit: 4
          })
        }).then(response => (response.ok ? response.json() : null)),

        fetch(`${endpoint}/slot-machine/fill-slots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: [
              ...(messagePayload.history || []),
              { id: generateUUID(), message: messagePayload.message, role: 'user' }
            ],
            slots: slotDefinitions,
            session_id: messagePayload.session_id
          })
        }).then(response => (response.ok ? response.json() : null))
      ]
    : [Promise.resolve(null), Promise.resolve(null), Promise.resolve(null)];

  const [chatResponse, actionIntentResponse, questionIntentResponse, slotResponse] = await Promise.all([
    chatPromise,
    actionIntentPromise,
    questionIntentPromise,
    slotPromise
  ]);

  return {
    chatResponse,
    actionIntentResponse,
    questionIntentResponse,
    slotResponse
  };
};

const sendMessageMutation: MutationFunction<
  SendMessageResponse,
  { messagePayload: Partial<SendMessageRequest>; rewards: any }
> = async ({ messagePayload, rewards }) => {
  const chatEnabled = import.meta.env.VITE_CHATBOT_ENABLED === 'true';
  if (!chatEnabled) {
    throw new Error(`${CHATBOT_NAME} is disabled`);
  }

  const { chatResponse, actionIntentResponse, questionIntentResponse, slotResponse } =
    await fetchEndpoints(messagePayload);

  if (!chatResponse.response) {
    throw new Error('Chatbot did not respond');
  }
  // initally set data to the chat response
  // we will override the response if we detect an action intent
  const data: SendMessageResponse = { ...chatResponse };

  if (
    actionIntentResponse.classification &&
    slotResponse.slots &&
    actionIntentResponse.classification !== 'NONE'
  ) {
    // if so, return the action intent button, accompanied by hard-coded text acknowledging the intent
    const actionIntents = handleActionIntent({
      classification: actionIntentResponse.classification,
      slots: slotResponse.slots,
      rewards,
      chains: [mainnet, base, arbitrum]
    });

    data.intents = actionIntents;
  }

  // next, check for question intents
  if (questionIntentResponse.recommendations && questionIntentResponse.recommendations.length > 0) {
    const questions = questionIntentResponse.recommendations.map(
      (rec: Recommendation) => rec.metadata.content
    );
    data.suggestions = questions;
  }

  return data;
};

export const useSendMessage = () => {
  const { chatHistory: history, setChatHistory, sessionId } = useChatContext();
  const { loading: LOADING, error: ERROR, canceled: CANCELED } = MessageType;
  const chainId = useChainId();
  const rewards = useAvailableTokenRewardContracts(chainId);
  const { mutate } = useMutation<
    SendMessageResponse,
    Error,
    { messagePayload: Partial<SendMessageRequest>; rewards: any }
  >({
    mutationFn: sendMessageMutation
  });

  const sendMessage = (message: string) => {
    mutate(
      {
        messagePayload: {
          session_id: sessionId,
          message,
          history: history
            .filter(record => record.type !== CANCELED)
            .map(record => ({
              ...record,
              role: record.user === UserType.user ? 'user' : 'assistant'
            }))
        },
        rewards
      },
      {
        onSuccess: data => {
          setChatHistory(prevHistory => {
            return prevHistory[prevHistory.length - 1].type === CANCELED
              ? prevHistory
              : [
                  ...prevHistory.filter(item => item.type !== LOADING),
                  {
                    id: generateUUID(),
                    user: UserType.bot,
                    message: data.response,
                    suggestions: data.suggestions,
                    intents: data.intents
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
