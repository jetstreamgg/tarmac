import { Zap } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { useConnection } from 'wagmi';
import { Switch } from './ui/switch';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';
import { useIsBatchSupported } from '@/hooks';
import { BATCH_TX_LEGAL_NOTICE_URL, BATCH_TX_SUPPORTED_WALLETS_URL } from '@/lib/constants';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';

const explainerLinkClasses = 'text-fgPrimary hover:underline';

/**
 * "Bundle transactions" section of the nav Menu dropdown (Figma 5069:27496):
 * 16px zap glyph + Label 5 text + S-size switch, Body 7 explainer underneath.
 * The comp shows only the explainer, but the Legal Notice link (and the
 * unsupported-wallet notice with its supporting-wallets link) carry over from
 * the old tooltip — they're disclosures, not decoration.
 */
export function BatchTransactionsToggle() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const { isConnected } = useConnection();
  const { data: batchSupported } = useIsBatchSupported();

  const batchNotSupported = isConnected && !batchSupported;

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-fgPrimary font-circle flex items-center gap-2 text-sm leading-4 font-medium tracking-[-0.28px]">
          <Zap size={16} className="text-fgBrand shrink-0" />
          <Trans>Bundle transactions</Trans>
        </span>
        <Switch
          size="sm"
          checked={batchEnabled}
          onCheckedChange={setBatchEnabled}
          disabled={batchNotSupported}
          aria-label={t`Toggle bundled transactions`}
          data-testid="batch-transactions-switch"
        />
      </div>
      <p className="text-fgSecondary max-w-[216px] text-[11px] leading-4">
        {batchNotSupported ? (
          <>
            <Trans>Your wallet does not currently support bundled transactions.</Trans>{' '}
            <ExternalLink
              href={BATCH_TX_SUPPORTED_WALLETS_URL}
              showIcon={false}
              className={explainerLinkClasses}
            >
              <Trans>View supporting wallets</Trans>
            </ExternalLink>
          </>
        ) : (
          <Trans>
            Save on gas and skip extra confirmations by grouping related actions into one transaction.
          </Trans>
        )}{' '}
        <ExternalLink href={BATCH_TX_LEGAL_NOTICE_URL} showIcon={false} className={explainerLinkClasses}>
          <Trans>Legal Notice</Trans>
        </ExternalLink>
      </p>
    </div>
  );
}
