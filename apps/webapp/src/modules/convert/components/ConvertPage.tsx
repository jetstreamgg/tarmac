import { useEffect, useRef } from 'react';
import { useChainId } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Button } from '@/components/ui/button';
import { HeaderBadge, PageHeaderHero } from '@/components/ui/page-header';
import { IllustrationStaked, IllustrationStakingLogomark } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { useConnectThenAct } from '@/modules/ui/context/ConnectThenActContext';
import { useAppAnalytics } from '@/modules/analytics/hooks/useAppAnalytics';
import { useConvertForm } from '../hooks/useConvertForm';
import { useConvertLaunch } from '../hooks/useConvertLaunch';
import type { PsmConversionDisabledReason } from '../hooks/usePsmConversion.helpers';
import { ConvertCard } from './ConvertCard';

// Same copy as the legacy PsmConversionWidget — the engine's guard reasons are
// unchanged, so the user-facing explanations carry over verbatim.
const getDisabledReasonText = (reason?: PsmConversionDisabledReason, targetTokenSymbol?: string) => {
  switch (reason) {
    case 'unsupported_chain':
      return t`This conversion is not available on the current network.`;
    case 'amount_too_small':
      return t`Enter a larger amount to continue.`;
    case 'psm_unavailable':
      return t`The mainnet Peg Stability Module is currently unavailable.`;
    case 'direction_halted':
      return t`This conversion direction is temporarily halted on mainnet.`;
    case 'non_zero_fee':
      return t`Mainnet wrapper fees are active right now, so this flow is temporarily disabled.`;
    case 'insufficient_liquidity':
      return t`Insufficient ${targetTokenSymbol || ''} liquidity`;
    default:
      return undefined;
  }
};

/**
 * The /convert destination (E2): a full-width page-as-widget PSM swap surface
 * (Figma 486:31193). The form lives on the page; Review launches the shared
 * transaction modal via `useConvertLaunch` (review → confirm-in-wallet → status).
 * PSM 1:1 USDC↔USDS only — CoW trading returns in E3 on the async-order contract.
 */
// Phone tier steps to the L button (48px, comp 1295:25314); XL at md.
const CTA_CLASSES =
  'h-12 w-full text-sm leading-4 tracking-[-0.28px] md:h-14 md:text-base md:leading-[18px] md:tracking-[-0.32px]';

export function ConvertPage() {
  const form = useConvertForm();
  const { launch, conversion, locked, restore } = useConvertLaunch({
    direction: form.direction,
    amount: form.amount,
    onSuccess: () => {
      form.mutateBalances();
      form.reset();
    }
  });
  const launchOrConnect = useConnectThenAct(launch, 'convert');
  const chainId = useChainId();
  const { trackConvertBlocked } = useAppAnalytics();

  // A PSM halt otherwise reads as organic drop-off (APP-444 H). Once per
  // distinct reason per mount — amount_too_small would fire per keystroke.
  const reportedReasons = useRef(new Set<string>());
  useEffect(() => {
    const reason = conversion.disabledReason;
    if (!reason || reportedReasons.current.has(reason)) return;
    reportedReasons.current.add(reason);
    trackConvertBlocked({ reason, chainId });
  }, [conversion.disabledReason, chainId, trackConvertBlocked]);

  const disabledReasonText = getDisabledReasonText(conversion.disabledReason, conversion.targetToken?.symbol);
  const reviewDisabled =
    form.isConnected && (form.isZero || form.insufficient || !!conversion.disabledReason);

  return (
    <div className="flex w-full flex-col items-center gap-8 py-4 md:py-10" data-testid="convert-page">
      {/* Patterns/Headers, Convert type 5044:35419. Desktop comp 1222:15248
          puts the badges 80px under the navbar — the outer md:py-10 plus this
          hero padding, same recipe as the Earn hero (APP-426 item 1). */}
      <PageHeaderHero
        className="md:py-10"
        badges={
          <>
            <HeaderBadge icon={<IllustrationStakingLogomark boxSize={16} />}>
              <Trans>1:1 Exchange rate</Trans>
            </HeaderBadge>
            <HeaderBadge icon={<IllustrationStaked boxSize={16} />}>
              <Trans>$0.00 Fees paid</Trans>
            </HeaderBadge>
          </>
        }
        title={<Trans>Convert stablecoins</Trans>}
        subtitle={
          <Trans>
            Move between stablecoins with confidence. Conversions settle at a fixed 1:1 rate, with no fees and
            no slippage.
          </Trans>
        }
        subtitleClassName="max-w-[459px]"
      />

      {/* Form column: the middle 6 columns of the design grid (624px @1280)
          minus 48px breathing room each side, per the Convert mock. */}
      <div className="flex w-full max-w-[528px] flex-col gap-4">
        {/* Inert while this flow's transaction is minimized (APP-448). */}
        <div inert={locked} className={locked ? 'opacity-50' : undefined} data-testid="convert-form">
          <ConvertCard form={form} />
        </div>

        {locked ? (
          <Text className="text-textSecondary text-sm" dataTestId="convert-locked">
            <Trans>A transaction is in progress. Open it to continue.</Trans>
          </Text>
        ) : form.insufficient ? (
          <Text className="text-error text-sm" dataTestId="convert-error">
            <Trans>Insufficient funds</Trans>
          </Text>
        ) : (
          disabledReasonText && (
            <Text className="text-error text-sm" dataTestId="convert-error">
              {disabledReasonText}
            </Text>
          )
        )}

        <Button
          variant="primary"
          size="xl"
          className={CTA_CLASSES}
          disabled={!locked && reviewDisabled}
          onClick={locked ? restore : launchOrConnect}
          data-testid={locked ? 'convert-open-transaction' : 'convert-review-cta'}
        >
          {locked ? <Trans>Open transaction</Trans> : <Trans>Review</Trans>}
        </Button>
      </div>
    </div>
  );
}
