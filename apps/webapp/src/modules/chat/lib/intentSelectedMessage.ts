import { UserType, MessageType } from '../constants';
import { ChatIntent } from '../types/Chat';
import { generateUUID } from './generateUUID';

export const intentSelectedMessage = (intent: ChatIntent) => {
  return {
    id: generateUUID(),
    user: UserType.bot,
    message: `I've updated the widget for you based on your selection of **"${intent.title}"**. Please confirm the details before proceeding.`,
    type: MessageType.internal
  };
};
