import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { useCallback } from 'react';
import { Warning } from '@/modules/icons/Warning';
import { getConfirmationWarningMetadata } from '../lib/confirmationWarningMetadata';

export const ConfirmationWarningRow = () => {
  const {
    setConfirmationWarningOpened,
    setSelectedIntent,
    hasShownIntent,
    setChatHistory,
    selectedIntent,
    warningShown,
    setWarningShown
  } = useChatContext();

  const navigate = useNavigate();

  const onIntentSelected = useCallback(
    (intent: ChatIntent) => setChatHistory(prev => [...prev, intentSelectedMessage(intent)]),
    []
  );

  const handleCancel = useCallback(
    (change: boolean) => {
      setConfirmationWarningOpened(change);
      setSelectedIntent(undefined);
    },
    [setConfirmationWarningOpened, setSelectedIntent]
  );

  const selectedIntentUrl = useRetainedQueryParams(selectedIntent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const handleConfirm = useCallback(() => {
    setConfirmationWarningOpened(false);
    if (selectedIntent && !hasShownIntent(selectedIntent)) {
      setWarningShown([...warningShown, selectedIntent]);
    }
    if (selectedIntentUrl) navigate(selectedIntentUrl);
    if (selectedIntent) onIntentSelected(selectedIntent);
  }, [
    selectedIntentUrl,
    setConfirmationWarningOpened,
    navigate,
    selectedIntent,
    onIntentSelected,
    warningShown,
    hasShownIntent
  ]);

  const disclaimerMetadata = getConfirmationWarningMetadata(selectedIntent);

  return (
    <div className="text-text mt-5 rounded-xl bg-[#0b0b0c]/60 p-5">
      <div className="flex items-center gap-2">
        <Warning boxSize={20} viewBox="0 0 16 16" fill="#fdc134" />
        <Text variant="medium">{disclaimerMetadata?.description}</Text>
      </div>
      <Text variant="terms" className="mt-2">
        {disclaimerMetadata?.disclaimer}
      </Text>
      <div className="mt-3 flex gap-5">
        <Button
          variant="pill"
          size="xs"
          className="border border-white/40 bg-transparent"
          onClick={() => handleCancel(false)}
        >
          Cancel
        </Button>
        <Button variant="pill" size="xs" onClick={handleConfirm}>
          Continue
        </Button>
      </div>
    </div>
  );
};
