import { CHATBOT_DOMAIN } from '@/lib/constants';
import { FEEDBACK_TYPE, type FeedbackType } from '../constants';
import { handleRestrictedResponse } from '../lib/ChatbotRestrictedError';

export interface FeedbackRequest {
  feedback_type: FeedbackType;
  comment: string | null;
  session_id: string;
}

// Re-export for convenience
export { FEEDBACK_TYPE };

export interface FeedbackResponse {
  message: string;
}

/**
 * Submit user feedback for a chat session
 * @param feedback - The feedback data to submit
 * @returns Promise with feedback response
 * @throws Error if the request fails
 */
export const submitFeedback = async (feedback: FeedbackRequest): Promise<FeedbackResponse> => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };

  const response = await fetch(`${CHATBOT_DOMAIN}/chatbot/feedback`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify(feedback)
  });

  if (!response.ok) {
    if (response.status === 403) {
      await handleRestrictedResponse(response);
    }
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Failed to submit feedback: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
};
