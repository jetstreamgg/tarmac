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

  // for testing, just logs the response
  const testPayload = [
    {
      promptText:
        '{"user_input":"Is the upgrade process the same on Base and mainnet?","labels":[{"label_name":"OTHER","label_description":"The assistant helps user which have questions on the the MKR to SKY rebranding, SKY ecosystem or crypto in general.","label_keywords":["Tell me about sky","What changes with the rebranding?","Can I borrow USDS like before with DAI?"]},{"label_name":"UPGRADE_MAINNET","label_description":"Upgrade widget allows for \'upgrading\' from the old tokens \'MKR\' and \'DAI\' to the new tokens, \'SKY\' and \'USDS\' (not to be confused with\'sUSDS\' which refers to the SAVINGS widget!). Upgrading is the official term, but can also be referred to as to \'update\' tokens. When using the upgrade widget, users are interacting directly with a converter smart contract that\'s part of the Sky Protocol which allows for unlimited liquidity between the tokens and also zero fees. In other words; upgrades and reverts is just an internal accounting operation and it\'s not comparable to a trade/swap.","label_keywords":["upgrade","update to","update from","wrap"]},{"label_name":"REVERT_MAINNET","label_description":"The revert widget allows for \'downgrading\' or \'reverting\' from the new tokens (USDS and SKY) to the old tokens (DAI and MKR). When using the upgrade widget, users are interacting directly with a converter smart contract that\'s part of the Sky Protocol which allows for unlimited liquidity between the tokens and also zero fees. In other words; upgrades and reverts is just an internal accounting operation and it\'s not comparable to a trade/swap.","label_keywords":["revert","downgrade","switch back","swap back"]},{"label_name":"TRADE_MAINNET","label_description":"The trade widget on Mainnet offers an integration with CoW Protocol, which is a DEX aggregator for token trades/swaps. The widget has been designed to be aligned with the Sky brand and only allow for trades that are relevant to the Sky ecosystem. For example, users can trade their existing stablecoins or ETH to Sky ecosystem tokens. These tokens include ETH, USDC, USDT, DAI, MKR, SKY, USDS, sUSDS.","label_keywords":["trade","buy","purchase","swap to","swap from"]},{"label_name":"TRADE_BASE","label_description":"The trade widget on Base offers the ability to swap between USDC, USDS, and sUSDS. The widget has been designed to be aligned with the Sky brand and only allow for trades that are relevant to the Sky ecosystem. The Base Trade Widget uses the PSM to exchange between USDC, USDS and sUSDS.","label_keywords":["trade","buy","purchase","swap to","swap from"]},{"label_name":"TRADE_ARBITRUM","label_description":"The trade widget on Arbitrum offers the ability to swap between USDC, USDS, and sUSDS. The widget has been designed to be aligned with the Sky brand and only allow for trades that are relevant to the Sky ecosystem. The Arbitrum Trade Widget uses the PSM to exchange between USDC, USDS and sUSDS.","label_keywords":["trade","buy","purchase","swap to","swap from"]},{"label_name":"REWARDS_MAINNET","label_description":"The Rewards widget facilitates interaction with Sky Token Rewards and Activation Rewards. The core mechanism involves a user supplying one type of token (supply token) to earn rewards denominated in another type of token (reward token). The following details describe the process:  1. Token Supply: The user supplies a specific token to participate in the rewards system. The token supply (USDS only at the moment) can be completely or partially withdrawn by the user at any time. 2. Proportional Rewards: The rewards received are proportional to the amount of tokens supplied. More tokens supplied result in higher rewards. 3. Reward Dynamics: The rewards rate may vary over time and is not guaranteed. 4. Flexibility: Users can withdraw both their supplied tokens and claim accrued rewards at any time.","label_keywords":["get rewards","earn token yield","earn token rewards","deposit into farming","withdraw from farming","farm tokens"]},{"label_name":"SAVINGS_MAINNET","label_description":"The savings widget provides access to the Sky Savings Rate, \'SSR\' in short. Sky Savings Rate (SSR) might be referred to as \'Dai Savings Rate\' (DSR) or \'USDS Savings Rate\' (USR) by users, but note that  Sky Savings Rate (SSR) is the correct term, DSR and USR might just be used colloquially! Therefore, use SSR instead of the other forms! USDS holders can deposit into the Sky Savings Rate (SSR) and receive tokenized shares called \'sUSDS\' (not to be confused with USDS token). The supply token can be withdrawn at any time from the SSR. This token is based on the ERC-4626 tokenized vault standard and will appreciate in value in accordance with the Sky Savings Rate (SSR). SAVINGS allows for better composability in DeFi and better capital efficiency, as the sUSDS token can be used in DeFi markets while appreciating in value.","label_keywords":["earn savings rate","earn SSR","earn savings yield","deposit into SSR","withdraw from SSR","save tokens","start saving"]},{"label_name":"SAVINGS_BASE","label_description":"The Base Savings widget provides access to the Sky Savings Rate on the Base Network, \'SSR\' in short. Sky Savings Rate (SSR) might be referred to as \'Dai Savings Rate\' (DSR) or \'USDS Savings Rate\' (USR) by users, but note that  Sky Savings Rate (SSR) is the correct term, DSR and USR might just be used colloquially! Therefore, use SSR instead of the other forms! USDS holders can deposit into the Sky Savings Rate (SSR) and receive tokenized shares called \'sUSDS\' (not to be confused with USDS token). The supply token can be withdrawn at any time from the SSR. This token is based on the ERC-4626 tokenized vault standard and will appreciate in value in accordance with the Sky Savings Rate (SSR). SAVINGS allows for better composability in DeFi and better capital efficiency, as the sUSDS token can be used in DeFi markets while appreciating in value. On Base, the Base Savings widget uses the PSM to exchange USDC or USDS to sUSDS.","label_keywords":["save on base","earn on base","earn savings rate","earn SSR","earn savings yield","deposit into SSR"]},{"label_name":"SAVINGS_ARBITRUM","label_description":"The Arbitrum Savings widget provides access to the Sky Savings Rate on the Arbitrum Network, \'SSR\' in short. Sky Savings Rate (SSR) might be referred to as \'Dai Savings Rate\' (DSR) or \'USDS Savings Rate\' (USR) by users, but note that  Sky Savings Rate (SSR) is the correct term, DSR and USR might just be used colloquially! Therefore, use SSR instead of the other forms! USDS holders can deposit into the Sky Savings Rate (SSR) and receive tokenized shares called \'sUSDS\' (not to be confused with USDS token). The supply token can be withdrawn at any time from the SSR. This token is based on the ERC-4626 tokenized vault standard and will appreciate in value in accordance with the Sky Savings Rate (SSR). SAVINGS allows for better composability in DeFi and better capital efficiency, as the sUSDS token can be used in DeFi markets while appreciating in value. On Arbitrum, the Arbitrum Savings widget uses the PSM to exchange USDC or USDS to sUSDS.","label_keywords":["save on arbitrum","earn on arbitrum","earn savings rate","earn SSR","earn savings yield","deposit into SSR"]},{"label_name":"SEALING_MAINNET","label_description":"The sealing widget provides access to the Sealed Activation feature. This is a more complex feature that allows users to \'seal\' their MKR or SKY upon which they can earn Sealed Activation Rewards. This feature is sometimes also referred to as \'lockstake\', \'lock\' or \'lockstake rewards\' (not to be confused with REWARDS feature) for sealing. And \'unlockstake\' or \'unlock\' for unsealing. They can also delegate the voting weight of their MKR and SKY to a delegate, and they can optionally draw a USDS debt using their collateral, i.e. borrow USDS.","label_keywords":["seal/unseal tokens","seal engine","earn seal rewards","sealing rewards","get/earn lockstake rewards","lock/unlock tokens","lockstake/unlockstake tokens"]}]}'
    }
  ];
  const response = await fetchTestChat(endpoint, JSON.stringify(testPayload));
  console.log('Test chat response:', response);

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

// TODO: remove this once we have a real endpoint
const fetchTestChat = async (endpoint: string, messagePayload: any) => {
  const response = await fetch(`${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: messagePayload
  });

  if (!response.ok) {
    throw new Error('Test chat response was not ok');
  }
  console.log('Test chat response:', response);
  return response.json();
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
