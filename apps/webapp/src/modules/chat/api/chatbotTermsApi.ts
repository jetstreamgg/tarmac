import { AcceptTermsRequest, AcceptTermsResponse, TermsStatusResponse } from '../types/chatbotTerms';

// Import mock implementations - always use mocks for now
import * as mockApi from './chatbotTermsApi.mock';

export const acceptChatbotTerms = async (data: AcceptTermsRequest): Promise<AcceptTermsResponse> => {
  // For now, always use mock
  return mockApi.acceptChatbotTerms(data);

  /* When backend is ready, replace with:
  const response = await fetch(`${CHATBOT_DOMAIN}/api/chatbot/accept-terms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important for cookies
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    // Backend handles all validation including rate limiting
    // Just throw the error for the UI to handle (400, 429, etc.)
    const error = await response.json();
    throw error;
  }

  return response.json();
  */
};

export const checkTermsAcceptance = async (): Promise<TermsStatusResponse> => {
  // For now, always use mock
  return mockApi.checkTermsAcceptance();

  /* When backend is ready, replace with:
  const response = await fetch(`${CHATBOT_DOMAIN}/api/chatbot/terms-status`, {
    credentials: 'include',
  });

  if (!response.ok) {
    return { accepted: false, reason: 'Request failed' };
  }

  return response.json();
  */
};

export const getChatbotTerms = async (): Promise<{ version: string; content: string }> => {
  // For now, always use mock
  return mockApi.getChatbotTerms();

  /* When backend is ready, replace with:
  // This could fetch from API or use env var
  const termsConfig = import.meta.env.VITE_CHATBOT_TERMS_TO_SIGN;
  
  if (!termsConfig) {
    throw new Error('Chatbot terms not configured');
  }

  // Parse the JSON string from env var
  const parsed = typeof termsConfig === 'string' ? JSON.parse(termsConfig) : termsConfig;
  
  return {
    version: parsed.version,
    content: parsed.content,
  };
  */
};

// Export mock helper for development/testing
export const clearMockTermsAcceptance = mockApi.clearMockTermsAcceptance;
