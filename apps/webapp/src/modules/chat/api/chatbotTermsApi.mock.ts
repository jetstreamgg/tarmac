import { AcceptTermsRequest, AcceptTermsResponse, TermsStatusResponse } from '../types/chatbotTerms';

// Mock storage for accepted terms (in-memory, will reset on page reload)
const mockStorage = {
  acceptedTerms: null as { acceptanceId: string; expiresAt: Date; version: string } | null
};

const CHATBOT_TERMS = import.meta.env.VITE_CHATBOT_TERMS_TO_SIGN;

// Mock implementation of acceptChatbotTerms
export const acceptChatbotTerms = async (data: AcceptTermsRequest): Promise<AcceptTermsResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Backend would validate version, but for mock just accept it

  // Create mock acceptance
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

  const acceptanceId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // Store in mock storage (will reset on page reload)
  mockStorage.acceptedTerms = {
    acceptanceId,
    expiresAt,
    version: data.termsVersion
  };

  return {
    success: true,
    acceptanceId,
    expiresAt: expiresAt.toISOString()
  };
};

// Mock implementation of checkTermsAcceptance
export const checkTermsAcceptance = async (): Promise<TermsStatusResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  // Check if we have accepted terms in memory
  if (!mockStorage.acceptedTerms) {
    return { accepted: false, reason: 'No token' };
  }

  // Check if expired
  const now = new Date();
  if (mockStorage.acceptedTerms.expiresAt < now) {
    mockStorage.acceptedTerms = null;
    return { accepted: false, reason: 'Terms expired' };
  }

  // Backend would check version match, mock just returns accepted
  return {
    accepted: true,
    acceptanceId: mockStorage.acceptedTerms.acceptanceId,
    termsVersion: mockStorage.acceptedTerms.version,
    expiresAt: mockStorage.acceptedTerms.expiresAt.toISOString()
  };
};

// Mock implementation of getChatbotTerms
export const getChatbotTerms = async (): Promise<{ version: string; content: string }> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200));

  // If env var is not set, return defaults
  if (!CHATBOT_TERMS) {
    throw new Error('No chatbot terms defined');
  }

  // Try to parse the JSON string from env var
  try {
    const parsed = typeof CHATBOT_TERMS === 'string' ? JSON.parse(CHATBOT_TERMS) : CHATBOT_TERMS;
    return {
      version: parsed.version || '',
      content: parsed.content || ''
    };
  } catch (e) {
    console.error('Error parsing CHATBOT_TERMS:', e);
    throw new Error('Invalid terms configuration');
  }
};

// Helper to clear mock terms acceptance (for testing)
export const clearMockTermsAcceptance = () => {
  mockStorage.acceptedTerms = null;
};
