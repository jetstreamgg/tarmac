import { L2TradeWidget, ExternalWidgetState } from '@jetstreamgg/widgets';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { useCustomConnectModal } from '../../hooks/useCustomConnectModal';
import { isBaseChainId, isArbitrumChainId } from '@jetstreamgg/utils';
import { useChainId } from 'wagmi';

interface TradeWidgetProps {
  externalWidgetState: ExternalWidgetState;
}

export function L2TradeWidgetDisplay({ externalWidgetState }: TradeWidgetProps) {
  const addRecentTransaction = useAddRecentTransaction();
  const onConnectModal = useCustomConnectModal();
  const chainId = useChainId();
  return (
    <L2TradeWidget
      onConnect={onConnectModal}
      addRecentTransaction={addRecentTransaction}
      locale="en"
      referralCode={1}
      rightHeaderComponent={undefined}
      externalWidgetState={externalWidgetState}
      onExternalLinkClicked={e => {
        const href = e.currentTarget.getAttribute('href');
        const linkText = e.currentTarget.textContent;
        console.log(href);
        console.log(linkText);

        const isAllowed = true; // Check here if the link is allowed
        if (!isAllowed) {
          e.preventDefault();
          console.log('Show modal');
        }
      }}
      widgetTitle={
        isBaseChainId(chainId) ? 'Base Trade' : isArbitrumChainId(chainId) ? 'Arbitrum Trade' : 'Trade'
      }
    />
  );
}
