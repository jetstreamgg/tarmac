import { Button } from '@/components/ui/button';
import { ChatIntent } from '../types/Chat';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { useChatContext } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';
import { useRetainedQueryParams } from '@/modules/ui/hooks/useRetainedQueryParams';
import { intentSelectedMessage } from '../lib/intentSelectedMessage';
import { QueryParams } from '@/lib/constants';
import { useCallback } from 'react';
import { Warning } from '@/modules/icons/Warning';
import { getConfirmationWarningMetadata } from '../lib/confirmationWarningMetadata';
import { ChatMarkdownRenderer } from '@/modules/ui/components/markdown/ChatMarkdownRenderer';
import { Trans } from '@lingui/react/macro';
import { useChatbotPrefillNotification } from '@/modules/app/hooks/useChatbotPrefillNotification';
import { useBreakpointIndex, BP } from '@/modules/ui/hooks/useBreakpointIndex';

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

  // On desktop (xl+) where chat floats, retain chat param to keep it open
  // On mobile (< xl) where chat is fullscreen, don't retain to allow it to close
  const retainedParams =
    bpi >= BP.md
      ? [QueryParams.Locale, QueryParams.Details, QueryParams.Chat]
      : [QueryParams.Locale, QueryParams.Details];
  const selectedIntentUrl = useRetainedQueryParams(selectedIntent?.url || '', retainedParams);

  const handleConfirm = useCallback(() => {
    setConfirmationWarningOpened(false);
    if (selectedIntent && !hasShownIntent(selectedIntent)) {
      setWarningShown([...warningShown, selectedIntent]);
    }
    if (selectedIntentUrl) {
      navigate(selectedIntentUrl);
      // Show notification that inputs have been prefilled
      showPrefillNotification();
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
    <div className="text-text @max-sm/chat:mt-3 @max-sm/chat:p-3 mt-5 rounded-xl bg-[#0b0b0c]/60 p-5">
      <div className="bg-white/6 @sm/chat:flex-row @max-sm/chat:gap-1.5 @max-sm/chat:p-3 flex flex-col items-center gap-2 rounded-lg p-4">
        <Warning
          boxSize={20}
          viewBox="0 0 16 16"
          fill="#fdc134"
          className="@max-sm/chat:h-4 @max-sm/chat:w-4 flex-shrink-0"
        />
        <Text variant="medium" className="@sm/chat:text-left @max-sm/chat:text-sm text-center">
          {disclaimerMetadata?.description}
        </Text>
      </div>
      <Heading variant="medium" tag="h4" className="@max-sm/chat:mt-2 @max-sm/chat:text-sm mt-4">
        <Trans>How it works:</Trans>
      </Heading>
      <div className="@max-sm/chat:ml-3 @max-sm/chat:mt-2 ml-4 mt-4 text-[13px]">
        <ChatMarkdownRenderer markdown={disclaimerMetadata?.disclaimer} />
      </div>
      <Heading variant="medium" tag="h4" className="@max-sm/chat:mt-2 @max-sm/chat:text-sm mt-4">
        <Trans>Associated risks:</Trans>
      </Heading>
      <div className="@max-sm/chat:ml-3 @max-sm/chat:mt-2 ml-4 mt-4 text-[13px]">
        <ChatMarkdownRenderer markdown={disclaimerMetadata?.associatedRisks?.join('\n') ?? ''} />
      </div>
      <div className="@max-sm/chat:mt-2 @max-sm/chat:gap-3 mt-3 flex gap-5">
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
