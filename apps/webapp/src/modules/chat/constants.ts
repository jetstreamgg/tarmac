import { msg } from '@lingui/core/macro';

export const CHATBOT_NAME = import.meta.env.VITE_CHATBOT_NAME || 'SkyWing';

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
