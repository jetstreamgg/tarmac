import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { sanitizeUrl } from '@/lib/utils';

type ChatIntentsRowProps = {
  intents: ChatIntent[];
};

export const ChatIntentsRow = ({ intents }: ChatIntentsRowProps) => {
  return (
    <div>
      <Text className="text-xs italic text-gray-500">Try a suggested action</Text>
      <div className="mt-2 flex flex-wrap gap-2">
        {intents.map((intent, index) => (
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
  const { setConfirmationModalOpened, setSelectedIntent, hasShownIntent, setChatHistory } = useChatContext();
  const navigate = useNavigate();
  const sanitizedIntentUrl = sanitizeUrl(intent?.url, {
    searchParamsOnly: true,
    allowExternalLinks: false
  });

  if (!sanitizedIntentUrl) return null;

  const intentUrl = useRetainedQueryParams(sanitizedIntentUrl, [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

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
    </Button>
  );
};
