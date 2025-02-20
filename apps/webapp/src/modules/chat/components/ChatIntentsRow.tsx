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

type ChatIntentsRowProps = {
  intents: ChatIntent[];
};

const testIntents = [
  {
    intent_description: 'Upgrade DAI',
    url: '/?widget=upgrade&source_token=DAI&flow=upgrade',
    intent_id: 'upgrade'
  },
  {
    intent_description: 'Upgrade 10 MKR',
    url: '/?widget=upgrade&source_token=MKR&flow=upgrade&input_amount=10',
    intent_id: 'upgrade'
  },
  {
    intent_description: 'Upgrade ZZZ',
    url: '/?widget=upgrade&source_token=ZZZ&flow=upgrade',
    intent_id: 'upgrade'
  },
  {
    intent_description: 'Revert USDS',
    url: '/?widget=upgrade&source_token=USDS&flow=revert',
    intent_id: 'upgrade'
  },
  {
    intent_description: 'Revert 7 SKY',
    url: '/?widget=upgrade&source_token=SKY&flow=revert&input_amount=7',
    intent_id: 'upgrade'
  },
  {
    intent_description: 'Revert ZZZ',
    url: '/?widget=upgrade&source_token=ZZZ&flow=revert',
    intent_id: 'upgrade'
  }
];

export const ChatIntentsRow = ({ intents }: ChatIntentsRowProps) => {
  console.log('🚀 ~ ChatIntentsRow ~ intents:', intents);
  return (
    <div>
      <Text className="text-xs italic text-gray-500">Try a suggested action</Text>
      <div className="mt-2 flex flex-wrap gap-2">
        {testIntents.map((intent, index) => (
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
        // console.log('🚀 ~ onMouseEnter ~ intent:', intent);
        // console.log('🚀 ~ IntentRow ~ intentUrl:', intentUrl);
      }}
    >
      {intent.intent_description}
      {network && <img src={`/networks/${network}.svg`} alt={`${network} logo`} className="ml-2 h-5 w-5" />}
    </Button>
  );
};
