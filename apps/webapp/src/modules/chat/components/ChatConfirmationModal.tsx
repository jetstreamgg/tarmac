import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Warning } from '@/modules/icons/Warning';
import { Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { ChatIntent } from '../types/Chat';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { getConfirmationModalMetadata } from '../lib/confirmationModalMetadata';
import { QueryParams } from '@/lib/constants';

export const ChatConfirmationModal: React.FC = () => {
  const {
    confirmationModalOpened,
    modalShown,
    selectedIntent,
    setConfirmationModalOpened,
    setChatHistory,
    setSelectedIntent,
    setModalShown,
    hasShownIntent
  } = useChatContext();

  const selectedIntentUrl = useRetainedQueryParams(selectedIntent?.url || '', [
    QueryParams.Locale,
    QueryParams.Details,
    QueryParams.Chat
  ]);

  const navigate = useNavigate();

  const onIntentSelected = useCallback(
    (intent: ChatIntent) => setChatHistory(prev => [...prev, intentSelectedMessage(intent)]),
    []
  );

  const handleCancel = useCallback(
    (change: boolean) => {
      setConfirmationModalOpened(change);
      setSelectedIntent(undefined);
    },
    [setConfirmationModalOpened, setSelectedIntent]
  );

  const handleConfirm = useCallback(() => {
    setConfirmationModalOpened(false);
    if (selectedIntent && !hasShownIntent(selectedIntent)) {
      setModalShown([...modalShown, selectedIntent]);
    }
    if (selectedIntentUrl) navigate(selectedIntentUrl);
    if (selectedIntent) onIntentSelected(selectedIntent);
  }, [
    selectedIntentUrl,
    setConfirmationModalOpened,
    navigate,
    selectedIntent,
    onIntentSelected,
    modalShown,
    hasShownIntent
  ]);

  const disclaimerMetadata = getConfirmationModalMetadata(selectedIntent);
  const defaultDisclaimer =
    'You are about to execute an action suggested by our AI chatbot. Please be aware that while we strive to provide accurate and helpful suggestions, you&apos;re solely responsible for reviewing and implementing any recommended actions. We do not guarantee the accuracy or completeness of the AI&apos;s suggestions and disclaim any liability for consequences arising from your use of this feature.';

  return (
    <Dialog open={!hasShownIntent(selectedIntent) && confirmationModalOpened} onOpenChange={handleCancel}>
      <DialogContent className="bg-containerDark flex w-full flex-col items-center justify-center rounded-none p-5 md:w-[480px] md:rounded-2xl md:p-10">
        <Warning boxSize={50} />

        <DialogHeader>
          <DialogTitle>
            <Text className="text-text text-center text-[28px] md:text-[32px]">Confirm Action</Text>
          </DialogTitle>
        </DialogHeader>
        <div className="flex w-full flex-col items-center justify-between gap-6">
          {selectedIntent && (
            <Text className="text-text text-center text-lg font-semibold">
              {selectedIntent.intent_description}
            </Text>
          )}
          <Text className="font-custom-450 text-text text-center">
            {disclaimerMetadata
              ? `${disclaimerMetadata.description} ${disclaimerMetadata.disclaimer}`
              : defaultDisclaimer}
          </Text>
          <Text className="font-custom-450 text-text text-center">
            If you wish to proceed, click &quot;Continue.&quot; If not, click &quot;Cancel&quot; to return to
            the chat.
          </Text>
          <div className="mt-4 flex w-full justify-between gap-6 sm:mt-0 sm:w-auto">
            <DialogClose asChild>
              <Button variant="secondary" className="flex-1 border" onClick={() => handleCancel(false)}>
                <Text>Cancel</Text>
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="default" className="flex-1" onClick={handleConfirm}>
                <Text>Continue</Text>
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
