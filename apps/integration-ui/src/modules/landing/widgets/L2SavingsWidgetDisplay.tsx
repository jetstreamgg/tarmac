import { L2SavingsWidget, ExternalWidgetState } from '@jetstreamgg/widgets';
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { useCustomConnectModal } from '../../hooks/useCustomConnectModal';
import { Token } from '@jetstreamgg/hooks';

interface SavingsWidgetProps {
  externalWidgetState: ExternalWidgetState;
  disallowedTokens?: { supply: Token[]; withdraw: Token[] };
}

export function L2SavingsWidgetDisplay({ externalWidgetState, disallowedTokens }: SavingsWidgetProps) {
  const addRecentTransaction = useAddRecentTransaction();
  const onConnectModal = useCustomConnectModal();

  return (
    <L2SavingsWidget
      onConnect={onConnectModal}
      addRecentTransaction={addRecentTransaction}
      locale="en"
      referralCode={1}
      rightHeaderComponent={undefined}
      externalWidgetState={externalWidgetState}
      disallowedTokens={disallowedTokens}
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
    />
  );
}
