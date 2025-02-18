export const CHATBOT_NAME = import.meta.env.VITE_CHATBOT_NAME || 'Skywing';

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

export const CHAT_SUGGESTIONS_ENABLED = import.meta.env.VITE_CHAT_SUGGESTIONS_ENABLED === 'true';
export const ADVANCED_CHAT_ENABLED = import.meta.env.VITE_ADVANCED_CHAT_ENABLED === 'true';
export const CHATBOT_ENABLED = import.meta.env.VITE_CHATBOT_ENABLED === 'true';
