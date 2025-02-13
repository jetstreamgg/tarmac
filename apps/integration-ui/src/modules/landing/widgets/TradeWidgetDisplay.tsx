import { TradeWidget as BaseTradeWidget, ExternalWidgetState } from '@jetstreamgg/widgets';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { useCustomConnectModal } from '../../hooks/useCustomConnectModal';
import { useState } from 'react';

export function TradeWidgetDisplay() {
  const addRecentTransaction = useAddRecentTransaction();
  const onConnectModal = useCustomConnectModal();

  const [tradeInitialState] = useState<ExternalWidgetState>({});

  return (
    <BaseTradeWidget
      key={tradeInitialState?.timestamp}
      onConnect={onConnectModal}
      addRecentTransaction={addRecentTransaction}
      locale="en"
      rightHeaderComponent={undefined}
      externalWidgetState={tradeInitialState}
    />
  );
}
