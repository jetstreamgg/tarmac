import { HStack } from '@/modules/layout/components/HStack';
import { DetailsSwitcher } from './DetailsSwitcher';
import { NetworkSwitcher } from './NetworkSwitcher';
import { ChatSwitcher } from './ChatSwitcher';
import { JSX } from 'react';

export function DualSwitcher(): JSX.Element {
  const chatEnabled = import.meta.env.VITE_CHATBOT_ENABLED === 'true';
  return (
    <HStack className="items-start gap-4 space-x-0">
      <NetworkSwitcher />
      <HStack className="items-center space-x-0">
        <DetailsSwitcher />
        {chatEnabled && <ChatSwitcher />}
      </HStack>
    </HStack>
  );
}
