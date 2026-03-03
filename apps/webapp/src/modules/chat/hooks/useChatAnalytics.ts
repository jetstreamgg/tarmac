import { useCallback } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useConnection } from 'wagmi';
import { ChatEvents, safeCapture, getViewport } from '@/modules/analytics/constants';
import { useChatContext } from '../context/ChatContext';
import type { InputLengthBucket } from '@/modules/analytics/constants';

function commonProps(sessionId: string, address: string | undefined) {
  return {
    session_id: sessionId,
    viewport: getViewport(),
    wallet_address: address ?? null
  };
}

export function useChatAnalytics() {
  const posthog = usePostHog();
  const { address } = useConnection();
  const { sessionId } = useChatContext();

  const common = useCallback(
    () => commonProps(sessionId, address),
    [sessionId, address]
  );

  const trackEntryImpression = useCallback(
    ({ entry_type }: { entry_type: string }) => {
      safeCapture(posthog, ChatEvents.ENTRY_IMPRESSION, { ...common(), entry_type });
    },
    [posthog, common]
  );

  const trackSuggestedQuestionsShown = useCallback(
    ({ question_count }: { question_count: number }) => {
      safeCapture(posthog, ChatEvents.SUGGESTED_QUESTIONS_SHOWN, { ...common(), question_count });
    },
    [posthog, common]
  );

  const trackSuggestedQuestionClicked = useCallback(
    ({ question_index }: { question_index: number }) => {
      safeCapture(posthog, ChatEvents.SUGGESTED_QUESTION_CLICKED, { ...common(), question_index });
    },
    [posthog, common]
  );

  const trackMessageAttempted = useCallback(
    ({
      input_length_bucket,
      message_source
    }: {
      input_length_bucket: InputLengthBucket;
      message_source: 'user_input' | 'suggested_question' | 'modifier_longer' | 'modifier_simpler';
    }) => {
      safeCapture(posthog, ChatEvents.MESSAGE_ATTEMPTED, { ...common(), input_length_bucket, message_source });
    },
    [posthog, common]
  );

  const trackTermsPrompted = useCallback(() => {
    safeCapture(posthog, ChatEvents.TERMS_PROMPTED, common());
  }, [posthog, common]);

  const trackTermsAccepted = useCallback(() => {
    safeCapture(posthog, ChatEvents.TERMS_ACCEPTED, common());
  }, [posthog, common]);

  const trackTermsDeclined = useCallback(() => {
    safeCapture(posthog, ChatEvents.TERMS_DECLINED, common());
  }, [posthog, common]);

  const trackTermsAbandoned = useCallback(
    ({ abandon_method }: { abandon_method: string }) => {
      safeCapture(posthog, ChatEvents.TERMS_ABANDONED, { ...common(), abandon_method });
    },
    [posthog, common]
  );

  const trackMessageSent = useCallback(
    ({ input_length_bucket, network }: { input_length_bucket: InputLengthBucket; network: string }) => {
      safeCapture(posthog, ChatEvents.MESSAGE_SENT, { ...common(), input_length_bucket, network });
    },
    [posthog, common]
  );

  const trackResponseReceived = useCallback(
    ({
      latency_ms,
      has_intents,
      intent_count
    }: {
      latency_ms: number;
      has_intents: boolean;
      intent_count: number;
    }) => {
      safeCapture(posthog, ChatEvents.RESPONSE_RECEIVED, {
        ...common(),
        latency_ms,
        has_intents,
        intent_count
      });
    },
    [posthog, common]
  );

  const trackWorkerError = useCallback(
    ({ status_code, error_type }: { status_code: number | undefined; error_type: string }) => {
      safeCapture(posthog, ChatEvents.WORKER_ERROR, { ...common(), status_code, error_type });
    },
    [posthog, common]
  );

  const trackIntentClicked = useCallback(
    ({ intent_title, intent_widget }: { intent_title: string; intent_widget: string }) => {
      safeCapture(posthog, ChatEvents.INTENT_CLICKED, { ...common(), intent_title, intent_widget });
    },
    [posthog, common]
  );

  const trackFeedbackSubmitted = useCallback(
    ({ feedback_type }: { feedback_type: string }) => {
      safeCapture(posthog, ChatEvents.FEEDBACK_SUBMITTED, { ...common(), feedback_type });
    },
    [posthog, common]
  );

  return {
    trackEntryImpression,
    trackSuggestedQuestionsShown,
    trackSuggestedQuestionClicked,
    trackMessageAttempted,
    trackTermsPrompted,
    trackTermsAccepted,
    trackTermsDeclined,
    trackTermsAbandoned,
    trackMessageSent,
    trackResponseReceived,
    trackWorkerError,
    trackIntentClicked,
    trackFeedbackSubmitted
  };
}
