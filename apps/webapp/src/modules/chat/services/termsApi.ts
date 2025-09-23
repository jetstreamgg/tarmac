import { CHATBOT_DOMAIN } from '@/lib/constants';

interface SignTermsResponse {
  success: boolean;
  acceptanceId: string;
  expiresAt: string;
}

interface CheckTermsResponse {
  accepted: boolean;
  acceptanceId?: string;
  termsVersion?: string;
  expiresAt?: string;
  reason?: string;
}

export const signChatbotTerms = async (termsVersion: string): Promise<SignTermsResponse> => {
  const response = await fetch(`${CHATBOT_DOMAIN}/chatbot/terms/sign`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ termsVersion })
  });

  if (!response.ok) {
    throw new Error(`Failed to sign terms: ${response.status}`);
  }

  return response.json();
};

export const checkChatbotTerms = async (): Promise<CheckTermsResponse> => {
  const response = await fetch(`${CHATBOT_DOMAIN}/chatbot/terms/check`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return { accepted: false, reason: 'Invalid or expired terms' };
  }

  const data = await response.json();
  return {
    accepted: true,
    ...data
  };
};
