import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ExternalLink } from '@/modules/layout/components/ExternalLink';
import { BATCH_TX_LEGAL_NOTICE_URL } from '@/lib/constants';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

/**
 * The "Save X% on network fees" card (Figma 1036:206803), shown above Confirm.
 *
 * Only appears to someone who had bundling switched off when the modal opened — see
 * `useBundlePromoVisible`. It deliberately stays on screen after the switch is flipped
 * (Figma 1036:207086): removing the card mid-session would yank the layout out from
 * under the click that just landed on it.
 *
 * The saving is quoted as a percentage rather than the mock's dollar amount: it comes
 * from a gas ratio, so the gas price and ETH price cancel and the number doesn't wobble
 * block to block.
 */
export function BundleSavingsPromo({ saving }: { saving: number }) {
  const [batchEnabled, setBatchEnabled] = useBatchToggle();
  const percent = saving * 100;

  return (
    <div
      className="border-borderSecondary flex flex-col gap-2 rounded-2xl border p-5"
      data-testid="bundle-savings-promo"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-fgPrimary font-circle flex items-center gap-2 text-base leading-[18px] font-medium tracking-[-0.32px]">
          <Zap size={16} className="text-fgBrand shrink-0" />
          {/* Sub-1% savings are rare, but round to the value rather than to "0%". */}
          <Trans>Save {percent < 1 ? percent.toFixed(2) : Math.round(percent)}% on network fees</Trans>
        </span>
        <Switch
          checked={batchEnabled}
          onCheckedChange={setBatchEnabled}
          aria-label={t`Toggle bundled transactions`}
          data-testid="bundle-promo-switch"
        />
      </div>
      <p className="text-fgSecondary text-xs leading-[18px]">
        <Trans>
          Approve + Supply run as one transaction. You sign once and bundled transactions saves you clicks and
          gas.
        </Trans>{' '}
        <ExternalLink
          href={BATCH_TX_LEGAL_NOTICE_URL}
          showIcon={false}
          className="text-fgPrimary hover:underline"
        >
          <Trans>Learn more</Trans>
        </ExternalLink>
      </p>
    </div>
  );
}
