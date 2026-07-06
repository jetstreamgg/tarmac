import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { StUsdsProviderType, StUsdsSelectionReason, type StUsdsProviderSelectionResult } from '@/hooks';
import { CurveLogo } from '@/widgets/shared/components/icons/CurveLogo';
import { Text } from '@/modules/layout/components/Typography';
import type { StUsdsLaunchFlow } from '../hooks/useStUsdsLaunch';
import {
  getProviderMessage,
  STUSDS_PREMIUM_HIGH_THRESHOLD,
  STUSDS_PREMIUM_WARNING_THRESHOLD
} from '../lib/providerNotice';

/**
 * Explains the liquidity route inside the stUSDS modal — the modal re-skin of
 * the retired widget's `ProviderIndicator`. Renders only when the transaction
 * routes through Curve (native is the silent default) or when no route is
 * available at all; while rates are being compared it shows a loading line.
 */
export function StUsdsProviderNotice({
  providerSelection,
  flow
}: {
  providerSelection: StUsdsProviderSelectionResult;
  flow: StUsdsLaunchFlow;
}) {
  const { i18n } = useLingui();
  const { selectedProvider, selectionReason, rateDifferencePercent, isLoading } = providerSelection;

  // Native route needs no callout (unless everything is blocked).
  if (
    selectedProvider === StUsdsProviderType.NATIVE &&
    selectionReason !== StUsdsSelectionReason.ALL_BLOCKED
  ) {
    return null;
  }

  const isCurve = selectedProvider === StUsdsProviderType.CURVE;
  const isWarning = selectionReason === StUsdsSelectionReason.ALL_BLOCKED;
  const isInfo =
    selectionReason === StUsdsSelectionReason.CURVE_ONLY_AVAILABLE ||
    selectionReason === StUsdsSelectionReason.CURVE_BETTER_RATE;

  if (isLoading) {
    return (
      <div
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 ${isInfo ? 'bg-accent/10' : 'bg-panel'}`}
        data-testid="stusds-provider-notice"
      >
        <LoaderCircle className="text-textSecondary h-4 w-4 animate-spin" />
        <Text variant="small" className="text-textSecondary">
          <Trans>Fetching rates</Trans>
        </Text>
      </div>
    );
  }

  const nativeState = providerSelection.nativeProvider?.state;
  const nativeMaxAmount =
    flow === 'supply' ? nativeState?.maxDeposit : (nativeState?.maxWithdraw ?? undefined);
  const message = getProviderMessage(
    selectionReason,
    rateDifferencePercent,
    flow,
    nativeState?.blockedReason,
    nativeMaxAmount,
    i18n
  );

  const isWarningPremium =
    Math.abs(rateDifferencePercent) > STUSDS_PREMIUM_WARNING_THRESHOLD &&
    Math.abs(rateDifferencePercent) <= STUSDS_PREMIUM_HIGH_THRESHOLD &&
    rateDifferencePercent < 0;
  const isHighPremium =
    Math.abs(rateDifferencePercent) > STUSDS_PREMIUM_HIGH_THRESHOLD && rateDifferencePercent < 0;
  const isDiscount = rateDifferencePercent > 0;

  // Style the percentage inside the message (premium amber/red, discount green).
  const percentMatch = message.match(/(\+?\d+\.?\d*%)/);
  const styledMessage =
    percentMatch && (isWarningPremium || isHighPremium || isDiscount) ? (
      <>
        {message.split(percentMatch[0])[0]}
        <span className={isDiscount ? 'text-bullish' : isHighPremium ? 'text-error' : 'text-amber-400'}>
          {percentMatch[0]}
        </span>
        {message.split(percentMatch[0])[1]}
      </>
    ) : (
      message
    );

  return (
    <div
      className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 ${
        isWarning ? 'bg-error/10' : isInfo ? 'bg-accent/10' : 'bg-panel'
      }`}
      data-testid="stusds-provider-notice"
    >
      {isCurve && !isWarning && <CurveLogo className="text-textSecondary mt-[3px] h-4 w-4 shrink-0" />}
      {isWarning && <TriangleAlert className="text-error mt-[3px] h-4 w-4 shrink-0" />}
      <Text variant="small" className={isWarning ? 'text-error' : 'text-textSecondary'}>
        {styledMessage}
      </Text>
    </div>
  );
}
