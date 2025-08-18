import { Trans } from '@lingui/react/macro';
import { Dispatch, SetStateAction } from 'react';
import { TradeConfigMenu } from './TradeConfigMenu';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { useAccount } from 'wagmi';
import { TokenForChain } from '@jetstreamgg/sky-hooks';
import { sepolia } from 'viem/chains';

type PropTypes = {
  slippage: string;
  setSlippage: (newSlippage: string) => void;
  isEthFlow?: boolean;
  ttl: string;
  originToken?: TokenForChain;
  setTtl: Dispatch<SetStateAction<string>>;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
};

export const TradeHeader = ({
  slippage,
  setSlippage,
  isEthFlow = false,
  ttl,
  setTtl
}: Omit<PropTypes, 'originToken' | 'onExternalLinkClicked'>): React.ReactElement => {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Heading variant="x-large">
        <Trans>Trade</Trans>
      </Heading>
      <TradeConfigMenu
        slippage={slippage}
        setSlippage={setSlippage}
        isEthFlow={isEthFlow}
        ttl={ttl}
        setTtl={setTtl}
      />
    </div>
  );
};

export const TradeSubHeader = () => (
  <Text className="text-textSecondary" variant="small">
    <Trans>Trade popular tokens for Sky Ecosystem tokens</Trans>
  </Text>
);

export const TradePoweredBy = ({
  onExternalLinkClicked
}: {
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => (
  <Text className="text-text mb-4 text-sm font-normal leading-none">
    Powered by{' '}
    <ExternalLink
      href="https://cow.fi/"
      showIcon={false}
      className="underline"
      onExternalLinkClicked={onExternalLinkClicked}
    >
      CoW Protocol
    </ExternalLink>
  </Text>
);

export const TradeWarning = ({ originToken }: { originToken?: TokenForChain }) => {
  const { chainId } = useAccount();
  const shouldShowUSDTWarning = originToken?.symbol === 'USDT' && chainId === sepolia.id;

  if (!shouldShowUSDTWarning) return null;

  return (
    <Text className="mt-1 text-[11px] font-normal leading-none text-orange-400">
      Need to reset the allowance to 0 before approving a new amount
    </Text>
  );
};
