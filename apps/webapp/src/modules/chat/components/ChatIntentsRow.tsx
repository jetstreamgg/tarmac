import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { useNetworkFromIntentUrl } from '../hooks/useNetworkFromUrl';
import { chainIdNameMapping, intentModifiesState } from '../lib/intentUtils';
import { useChainId } from 'wagmi';
import { ConfirmationWarningRow } from './ConfirmationWarningRow';

type ChatIntentsRowProps = {
  intents: ChatIntent[];
};

export const ChatIntentsRow = ({ intents }: ChatIntentsRowProps) => {
  const { shouldShowConfirmationWarning } = useChatContext();

  return (
    <div>
      <Text className="text-xs italic text-gray-500">Try a suggested action</Text>
      <div className="mt-2 flex flex-wrap gap-2">
        {intents.map((intent, index) => (
          <IntentRow key={index} intent={intent} />
        ))}
      </div>
      {shouldShowConfirmationWarning && <ConfirmationWarningRow />}
    </div>
  );
};

type IntentRowProps = {
  intent: ChatIntent;
};

const IntentRow = ({ intent }: IntentRowProps) => {
  const chainId = useChainId();
  const { setConfirmationWarningOpened, setSelectedIntent, setChatHistory, hasShownIntent } =
    useChatContext();
  const navigate = useNavigate();
  const intentUrl = useRetainedQueryParams(intent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const network =
    useNetworkFromIntentUrl(intentUrl) || chainIdNameMapping[chainId as keyof typeof chainIdNameMapping];
  const modifiesState = intentModifiesState(intent);

  return (
    <Button
      variant="suggest"
      onClick={() => {
        setConfirmationWarningOpened(false);

        if (!hasShownIntent(intent) && modifiesState) {
          setConfirmationWarningOpened(true);
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
