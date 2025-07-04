export interface ChatbotTermsConfig {
  terms_version: string;
  terms_timestamp: number;
  terms: string;
}

export interface AcceptTermsRequest {
  termsVersion: string;
}

export interface AcceptTermsResponse {
  success: boolean;
  acceptanceId: string;
  expiresAt: string;
}

export interface TermsStatusResponse {
  accepted: boolean;
  acceptanceId?: string;
  termsVersion?: string;
  expiresAt?: string;
  reason?: string;
  currentVersion?: string;
}

export interface ChatbotTermsError {
  error: string;
  code: 'TERMS_NOT_ACCEPTED' | 'TERMS_VERSION_MISMATCH' | 'TERMS_EXPIRED' | 'INVALID_TERMS_TOKEN';
  currentVersion?: string;
}
