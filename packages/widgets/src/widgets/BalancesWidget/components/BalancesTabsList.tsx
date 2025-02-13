import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trans } from '@lingui/react/macro';
import { BalancesFlow } from '../constants';

interface BalancesTabsListProps {
  disabled?: boolean;
  onToggle: (number: 0 | 1) => void;
}

export const BalancesTabsList: React.FC<BalancesTabsListProps> = ({ disabled = false, onToggle }) => (
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger
      position="left"
      disabled={disabled}
      data-testid="balances-toggle-left"
      value={BalancesFlow.FUNDS}
      onClick={() => onToggle(0)}
    >
      <Trans>Funds</Trans>
    </TabsTrigger>
    <TabsTrigger
      position="right"
      disabled={disabled}
      data-testid="balances-toggle-right"
      value={BalancesFlow.TX_HISTORY}
      onClick={() => onToggle(1)}
    >
      <Trans>Transaction history</Trans>
    </TabsTrigger>
  </TabsList>
);
