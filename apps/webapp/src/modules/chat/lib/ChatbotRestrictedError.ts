/**
 * Error code returned by chatbot endpoints when the user is in a restricted jurisdiction
 */
export const CHATBOT_REGION_RESTRICTED_ERROR_CODE = 'CHATBOT_REGION_RESTRICTED';

/**
 * Response body structure for 403 restricted responses from chatbot endpoints
 */
interface RestrictedErrorResponse {
  error: string;
  error_code: string;
  country_code?: string;
}

/**
 * Custom error class for chatbot jurisdiction restrictions.
 * Thrown when any chatbot endpoint returns 403 Forbidden.
 * Callers should catch this and set the restricted state in ChatContext.
 */
export class ChatbotRestrictedError extends Error {
  readonly errorCode?: string;
  readonly countryCode?: string;

  constructor(
    message = 'Chatbot is not available in your jurisdiction',
    errorCode?: string,
    countryCode?: string
  ) {
    super(message);
    this.name = 'ChatbotRestrictedError';
    this.errorCode = errorCode;
    this.countryCode = countryCode;
  }
}

/**
 * Type guard to check if an error is a ChatbotRestrictedError
 */
export const isChatbotRestrictedError = (error: unknown): error is ChatbotRestrictedError => {
  return error instanceof ChatbotRestrictedError;
};

/**
 * Handles a 403 response from a chatbot endpoint.
 * Parses the response body, logs the error details, and throws ChatbotRestrictedError
 * only if the error code matches CHATBOT_REGION_RESTRICTED_ERROR_CODE.
 * For other 403 errors, throws a generic Error.
 */
export const handleRestrictedResponse = async (response: Response): Promise<never> => {
  let errorData: RestrictedErrorResponse | null = null;

  try {
    errorData = await response.json();
  } catch {
    // Response body couldn't be parsed, proceed with default error
  }

  if (errorData) {
    console.error('[Chatbot] 403 error:', {
      error: errorData.error,
      errorCode: errorData.error_code,
      countryCode: errorData.country_code
    });

    if (errorData.error_code === CHATBOT_REGION_RESTRICTED_ERROR_CODE) {
      throw new ChatbotRestrictedError(errorData.error, errorData.error_code, errorData.country_code);
    }

    throw new Error(errorData.error || 'Request forbidden');
  }

  throw new Error('Request forbidden');
};
