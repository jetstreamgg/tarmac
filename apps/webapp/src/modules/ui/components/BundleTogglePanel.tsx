import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Layers, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverPortal, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { BATCH_TX_LEGAL_NOTICE_URL } from '@/lib/constants';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

/**
 * The `Bundled` / `Not bundled` badge that sits beside the network fee, and the panel it
 * opens (Figma 1036:206945 / 1036:207016).
 *
 * Figma draws the panel over a hovered badge, but it contains a working switch, so it is
 * a click-opened Popover rather than a Tooltip — a hover surface can't be operated by
 * keyboard or touch.
 *
 * The switch writes the app-wide preference (`useBatchToggle`), so flipping it here also
 * changes the nav menu and every later transaction.
 */
export function BundleTogglePanel() {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-testid="bundle-toggle-badge" aria-label={t`Bundled transactions`}>
          <Badge variant={batchEnabled ? 'brand' : 'neutral'}>
            {batchEnabled ? <Zap width={12} height={12} /> : <Layers width={12} height={12} />}
            {batchEnabled ? <Trans>Bundled</Trans> : <Trans>Not bundled</Trans>}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent align="start" className="flex w-[260px] flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-fgPrimary font-circle flex items-center gap-2 text-sm leading-4 font-medium tracking-[-0.28px]">
              <Zap size={16} className="text-fgBrand shrink-0" />
              <Trans>Bundle transactions</Trans>
            </span>
            <Switch
              checked={batchEnabled}
              onCheckedChange={setBatchEnabled}
              aria-label={t`Toggle bundled transactions`}
              data-testid="bundle-panel-switch"
            />
          </div>
          <p className="text-fgSecondary text-xs leading-[18px]">
            <Trans>
              Approve + Supply run as one transaction. You sign once and bundled transactions saves you clicks
              and gas.
            </Trans>{' '}
            <ExternalLink
              href={BATCH_TX_LEGAL_NOTICE_URL}
              showIcon={false}
              className="text-fgPrimary hover:underline"
            >
              <Trans>Learn more</Trans>
            </ExternalLink>
          </p>
        </PopoverContent>
      </PopoverPortal>
    </Popover>
  );
}
