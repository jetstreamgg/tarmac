import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Toggle } from './ui/toggle';
import { Zap } from '@/modules/icons/Zap';
import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { useAccount } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { BATCH_TX_LEGAL_NOTICE_URL } from '@/lib/constants';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export function BatchTransactionsToggle() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const { isConnected } = useAccount();
  const { data: batchSupported } = useIsBatchSupported();

  const batchNotSupported = isConnected && !batchSupported;

  const handleToggle = (checked: boolean) => {
    setBatchEnabled(checked);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Toggle
            variant="singleSwitcherBright"
            className="h-10 w-10 rounded-xl p-0"
            pressed={batchEnabled}
            onPressedChange={handleToggle}
            aria-label="Toggle bundled transactions"
            disabled={batchNotSupported}
          >
            <Zap width={28} height={28} />
          </Toggle>
        </div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent arrowPadding={10} className="max-w-[300px]">
          <Text variant="small">
            {batchNotSupported
              ? t`Your wallet or the chain you are connected to currently does not support bundled transactions`
              : t`Bundled transactions ${batchEnabled ? 'enabled' : 'disabled'}`}
          </Text>
          <ExternalLink
            href={BATCH_TX_LEGAL_NOTICE_URL}
            className="text-textEmphasis hover:text-textEmphasis self-start text-sm hover:underline"
            showIcon={false}
          >
            <Trans>Legal Notice</Trans>
          </ExternalLink>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
