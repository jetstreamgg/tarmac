import { MessageType, UserType } from '../constants';

export interface SendMessageRequest {
  session_id: string;
  messages: ChatMessage[];
  promptText?: string;
  network: string;
}

export interface SendMessageResponse {
  response: string;
  intents?: ChatIntent[];
  knowledge_date?: string;
}

export interface ChatHistory {
  id: string;
  user: UserType;
  message: string;
  type?: MessageType;
  role?: string;
  intents?: ChatIntent[];
}

export interface ChatMessage {
  content: string;
  role: string;
}

export interface ChatIntent {
  intent_id: string;
  title: string;
  url: string;
  widget: string;
  priority: number;
}

export enum SlotType {
  Amount = 'input_amount',
  SourceToken = 'source_token',
  TargetToken = 'target_token',
  Tab = 'tab'
}

export interface Slot {
  description: string;
  field: SlotType;
  slot_type: string;
  valid: boolean;
  raw_value?: string | null;
  parsed_value?: string | null;
  parse_error?: string | null;
  js_validator?: string | null;
  format?: string | null;
}

export type Recommendation = {
  metadata: {
    content: string;
  };
};
