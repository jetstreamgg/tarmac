import { Trans } from '@lingui/react/macro';
import { Dispatch, SetStateAction } from 'react';
import { TradeConfigMenu } from './TradeConfigMenu';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { ExternalLink } from '@widgets/shared/components/ExternalLink';
import { CoW } from '@widgets/shared/components/icons/CoW';

type PropTypes = {
  slippage: string;
  setSlippage: (newSlippage: string) => void;
  isEthFlow?: boolean;
  ttl: string;
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
  <div className="mb-4 flex items-center gap-1.5">
    <Text className="text-text text-sm leading-none font-normal">
      Powered by{' '}
      <ExternalLink
        href="https://cow.fi/"
        showIcon={true}
        iconSize={12}
        wrapperClassName="gap-1"
        onExternalLinkClicked={onExternalLinkClicked}
      >
        CoW Protocol
      </ExternalLink>
    </Text>
    <CoW className="rounded-[0.25rem]" />
  </div>
);
