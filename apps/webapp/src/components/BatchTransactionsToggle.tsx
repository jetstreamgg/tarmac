import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { Toggle } from './ui/toggle';
import { Zap } from '@/modules/icons/Zap';
import { Tooltip, TooltipArrow, TooltipContent, TooltipPortal, TooltipTrigger } from './ui/tooltip';
import { Text } from '@/modules/layout/components/Typography';
import { t } from '@lingui/core/macro';
import { useIsBatchSupported } from '@jetstreamgg/sky-hooks';
import { useConnection } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { BATCH_TX_LEGAL_NOTICE_URL, BATCH_TX_SUPPORTED_WALLETS_URL } from '@/lib/constants';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

export function BatchTransactionsToggle() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const { isConnected } = useConnection();
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
            className="hidden h-10 w-10 rounded-xl p-0 md:flex"
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
        <TooltipContent arrowPadding={10} className="max-w-[260px]">
          <Text variant="small">
            {batchNotSupported ? (
              <>
                {t`Your wallet does not currently support bundled transactions`}
                <ExternalLink
                  href={BATCH_TX_SUPPORTED_WALLETS_URL}
                  className="text-textEmphasis hover:text-textEmphasis hover:underline"
                  showIcon={false}
                >
                  <Trans>View supporting wallets</Trans>
                </ExternalLink>
              </>
            ) : (
              t`Bundled transactions ${batchEnabled ? 'enabled' : 'disabled'}`
            )}
          </Text>
          <Text variant="small">
            <ExternalLink
              href={BATCH_TX_LEGAL_NOTICE_URL}
              className="text-textEmphasis hover:text-textEmphasis self-start hover:underline"
              showIcon={false}
            >
              <Trans>Legal Notice</Trans>
            </ExternalLink>
          </Text>
          <TooltipArrow width={12} height={8} />
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
