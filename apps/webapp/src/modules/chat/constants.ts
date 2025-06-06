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
  canceled = 'canceled'
}
