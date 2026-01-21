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
import { ChatMarkdownRenderer } from '@/modules/ui/components/markdown/ChatMarkdownRenderer';
import { useChatbotPrefillNotification } from '@/modules/app/hooks/useChatbotPrefillNotification';
import { hasPreFillParameters } from '../lib/intentUtils';
import { BP, useBreakpointIndex } from '@/modules/ui/hooks/useBreakpointIndex';

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
  const { showPrefillNotification } = useChatbotPrefillNotification();
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

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

  // On mobile, don't retain chat param (chat closes after action)
  // On desktop, retain chat param to keep chat open after clicking Continue
  const retainedParams = isMobile
    ? [QueryParams.Locale, QueryParams.Details]
    : [QueryParams.Locale, QueryParams.Details, QueryParams.Chat];

  const selectedIntentUrl = useRetainedQueryParams(selectedIntent?.url || '', retainedParams);

  const handleConfirm = useCallback(() => {
    setConfirmationWarningOpened(false);
    if (selectedIntent && !hasShownIntent(selectedIntent)) {
      setWarningShown([...warningShown, selectedIntent]);
    }
    if (selectedIntentUrl) {
      navigate(selectedIntentUrl);
      // Show notification only if the intent has pre-fill parameters
      if (selectedIntent && hasPreFillParameters(selectedIntent)) {
        showPrefillNotification();
      }
    }
    if (selectedIntent) onIntentSelected(selectedIntent);
  }, [
    selectedIntentUrl,
    setConfirmationWarningOpened,
    navigate,
    selectedIntent,
    onIntentSelected,
    warningShown,
    hasShownIntent,
    showPrefillNotification
  ]);

  const disclaimerMetadata = getConfirmationWarningMetadata(selectedIntent);

  return (
    <div className="text-text mt-5 rounded-xl bg-[#0b0b0c]/60 p-5 @max-sm/chat:mt-3 @max-sm/chat:p-3">
      <div className="flex flex-col items-center gap-2 rounded-lg bg-white/6 p-4 @max-sm/chat:gap-1.5 @max-sm/chat:p-3 @sm/chat:flex-row">
        <Warning
          boxSize={20}
          viewBox="0 0 16 16"
          fill="#fdc134"
          className="flex-shrink-0 @max-sm/chat:h-4 @max-sm/chat:w-4"
        />
        <Text variant="medium" className="text-center @max-sm/chat:text-sm @sm/chat:text-left">
          {disclaimerMetadata?.description}
        </Text>
      </div>
      <div className="mt-4 ml-4 text-[13px] @max-sm/chat:mt-2 @max-sm/chat:ml-3">
        <ChatMarkdownRenderer markdown={disclaimerMetadata?.disclaimer} />
      </div>
      <div className="mt-3 flex gap-5 @max-sm/chat:mt-2 @max-sm/chat:gap-3">
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
