import { HStack } from '@/modules/layout/components/HStack';
import { DetailsSwitcher } from './DetailsSwitcher';
import { NetworkSwitcher } from './NetworkSwitcher';
import { ChatSwitcher } from './ChatSwitcher';
import { JSX } from 'react';
import { CHATBOT_ENABLED } from '@/lib/constants';

export function DualSwitcher(): JSX.Element {
  return (
    <HStack className="items-start gap-4 space-x-0">
      <NetworkSwitcher />
      <HStack className="items-center space-x-0">
        <DetailsSwitcher />
        {CHATBOT_ENABLED && <ChatSwitcher />}
      </HStack>
    </HStack>
  );
}
