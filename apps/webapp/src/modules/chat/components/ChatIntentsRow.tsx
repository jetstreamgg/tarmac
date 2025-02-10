import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { useNetworkFromIntentUrl } from '../hooks/useNetworkFromUrl';
import { chainIdNameMapping } from '../lib/intentUtils';
import { useChainId } from 'wagmi';
import { isBaseChainId } from '@jetstreamgg/utils';

type ChatIntentsRowProps = {
  intents: ChatIntent[];
};

const mainnetIntents = [
  {
    intent_description: 'Go to Savings on Base',
    url: '?widget=savings&network=base',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 50 USDC to Savings', // this shoud be wrong
    url: '?widget=savings&input_amount=50&source_token=USDC&network=ethereum&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 30 USDS to Savings',
    url: '?widget=savings&input_amount=30&source_token=USDS&network=ethereum&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 1000 USDS to Savings',
    url: '?widget=savings&input_amount=1000&source_token=USDS&network=ethereum&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply to Savings',
    url: '?widget=savings&network=ethereum&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 1000 to Savings',
    url: '?widget=savings&input_amount=1000&network=ethereum&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 50 USDC from Savings', // this should be wrong
    url: '?widget=savings&input_amount=50&source_token=USDC&network=ethereum&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 30 USDS from Savings',
    url: '?widget=savings&input_amount=30&source_token=USDS&network=ethereum&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 1000 USDS from Savings',
    url: '?widget=savings&input_amount=1000&source_token=USDS&network=ethereum&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw from Savings',
    url: '?widget=savings&network=ethereum&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 1000 from Savings',
    url: '?widget=savings&input_amount=1000&network=ethereum&tab=right',
    intent_id: 'savings'
  }
];

const baseIntents = [
  {
    intent_description: 'Go to Savings on Mainnet',
    url: '?widget=savings&network=ethereum',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 50 USDC to Savings', // this should be wrong
    url: '?widget=savings&input_amount=50&source_token=USDC&network=base&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 30 USDS to Savings',
    url: '?widget=savings&input_amount=30&source_token=USDS&network=base&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 1000 USDS to Savings',
    url: '?widget=savings&input_amount=1000&source_token=USDS&network=base&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply to Savings',
    url: '?widget=savings&network=base&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Supply 1000 to Savings',
    url: '?widget=savings&input_amount=1000&network=base&tab=left',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 50 USDC from Savings', // this should be wrong
    url: '?widget=savings&input_amount=50&source_token=USDC&network=base&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 30 USDS from Savings',
    url: '?widget=savings&input_amount=30&source_token=USDS&network=base&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 1000 USDS from Savings',
    url: '?widget=savings&input_amount=1000&source_token=USDS&network=base&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw from Savings',
    url: '?widget=savings&network=base&tab=right',
    intent_id: 'savings'
  },
  {
    intent_description: 'Withdraw 1000 from Savings',
    url: '?widget=savings&input_amount=1000&network=base&tab=right',
    intent_id: 'savings'
  }
];

export const ChatIntentsRow = ({ intents }: ChatIntentsRowProps) => {
  console.log('🚀 ~ ChatIntentsRow ~ intents:', intents);
  const chainId = useChainId();
  const isBase = isBaseChainId(chainId);

  return (
    <div>
      <Text className="text-xs italic text-gray-500">Try a suggested action</Text>
      <div className="mt-2 flex flex-wrap gap-2">
        {(isBase ? baseIntents : mainnetIntents).map((intent, index) => (
          <IntentRow key={index} intent={intent} />
        ))}
      </div>
    </div>
  );
};

type IntentRowProps = {
  intent: ChatIntent;
};

const IntentRow = ({ intent }: IntentRowProps) => {
  const chainId = useChainId();
  const { setConfirmationModalOpened, setSelectedIntent, hasShownIntent, setChatHistory } = useChatContext();
  const navigate = useNavigate();
  const intentUrl = useRetainedQueryParams(intent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const network =
    useNetworkFromIntentUrl(intentUrl) || chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];

  return (
    <Button
      variant="suggest"
      onClick={() => {
        if (!hasShownIntent(intent)) {
          setConfirmationModalOpened(true);
          setSelectedIntent(intent);
        } else {
          setChatHistory(prev => [...prev, intentSelectedMessage(intent)]);
          navigate(intentUrl);
        }
      }}
      onMouseEnter={() => {
        console.log('🚀 ~ onMouseEnter ~ intent:', intent);
        console.log('🚀 ~ IntentRow ~ intentUrl:', intentUrl);
      }}
    >
      {intent.intent_description}
      {network && <img src={`/networks/${network}.svg`} alt={`${network} logo`} className="ml-2 h-5 w-5" />}
    </Button>
  );
};
