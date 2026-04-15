import { HStack } from '@/modules/layout/components/HStack';
import { DetailsSwitcher } from './DetailsSwitcher';
import { NetworkSwitcher } from './NetworkSwitcher';
import { JSX } from 'react';
import { cn } from '@/lib/utils';
export function DualSwitcher({ className }: { className?: string }): JSX.Element {
  return (
    <HStack className={cn('items-start gap-3 space-x-0', className)}>
      <NetworkSwitcher />
      <HStack className="items-center space-x-0">
        <DetailsSwitcher />
      </HStack>
    </HStack>
  );
}
