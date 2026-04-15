import { Trans } from '@lingui/react/macro';
import { Dispatch, SetStateAction } from 'react';
import { TradeConfigMenu } from './TradeConfigMenu';
import { Heading, Text } from '@widgets/shared/components/ui/Typography';
import { CoW } from '@widgets/shared/components/icons/CoW';

type PropTypes = {
  slippage: string;
  setSlippage: (newSlippage: string) => void;
  isEthFlow?: boolean;
  ttl: string;
  setTtl: Dispatch<SetStateAction<string>>;
};

export const TradeHeader = ({
  slippage,
  setSlippage,
  isEthFlow = false,
  ttl,
  setTtl
}: PropTypes): React.ReactElement => {
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

export const TradePoweredBy = () => (
  <div className="mb-4 flex items-center gap-1.5">
    <Text className="text-text text-sm leading-none font-normal">Powered by CoW Protocol</Text>
    <CoW className="rounded-[0.25rem]" />
  </div>
);

