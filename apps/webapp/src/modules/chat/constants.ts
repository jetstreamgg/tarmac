import { msg } from '@lingui/core/macro';

export const CHATBOT_NAME = import.meta.env.VITE_CHATBOT_NAME || '';

export enum UserType {
  user = 'You',
  bot = CHATBOT_NAME
}

export enum MessageType {
  loading = 'loading',
  error = 'error',
  text = 'text',
  internal = 'internal',
  canceled = 'canceled',
  authError = 'authError'
}

export const TERMS_ACCEPTANCE_MESSAGE = msg`Please accept the chatbot terms of service to continue.`;

// Feedback types for the /feedback endpoint
export const FEEDBACK_TYPE = {
  THUMBS_UP: 'thumbs_up',
  THUMBS_DOWN: 'thumbs_down'
} as const;

export type FeedbackType = (typeof FEEDBACK_TYPE)[keyof typeof FEEDBACK_TYPE];
