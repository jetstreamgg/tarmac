import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Text } from '@widgets/shared/components/ui/Typography';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { StUsdsProviderType, StUsdsSelectionReason, StUsdsBlockedReason } from '@jetstreamgg/sky-hooks';
import { CurveLogo } from '@widgets/shared/components/icons/CurveLogo';
import { LoadingSpinner } from '@widgets/shared/components/ui/spinner/LoadingSpinner';
import {
  getProviderMessage,
  StUSDSFlow,
  STUSDS_PREMIUM_WARNING_THRESHOLD,
  STUSDS_PREMIUM_HIGH_THRESHOLD
} from '../lib/constants';

export type ProviderIndicatorProps = {
  selectedProvider: StUsdsProviderType;
  selectionReason: StUsdsSelectionReason;
  rateDifferencePercent: number;
  flow: StUSDSFlow;
  isLoading?: boolean;
  /** Specific reason why native is blocked */
  nativeBlockedReason?: StUsdsBlockedReason;
  /** Max amount available via native (for amount-exceeds scenarios) */
  nativeMaxAmount?: bigint;
};

/**
 * Shows which liquidity provider is being used for the transaction.
 * Only displays when Curve is selected (native is the default).
 */
export function ProviderIndicator({
  selectedProvider,
  selectionReason,
  rateDifferencePercent,
  flow,
  isLoading = false,
  nativeBlockedReason,
  nativeMaxAmount
}: ProviderIndicatorProps) {
  const { i18n } = useLingui();

  // Don't show indicator when using native (unless all providers are blocked)
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

  // Show loading state with spinner
  if (isLoading) {
    return (
      <HStack
        className={`w-full items-center justify-start rounded-lg px-3 py-2 ${isInfo ? 'bg-accent/10' : 'bg-surface'}`}
        gap={2}
      >
        <LoadingSpinner className="text-textSecondary h-4 w-4" />
        <Text variant="small" className="text-textSecondary">
          <Trans>Fetching rates</Trans>
        </Text>
      </HStack>
    );
  }

  const message = getProviderMessage(
    selectionReason,
    rateDifferencePercent,
    flow,
    nativeBlockedReason,
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

  return (
    <HStack
      className={`w-full items-start justify-start rounded-lg px-3 py-2 ${
        isWarning ? 'bg-error/10' : isInfo ? 'bg-accent/10' : 'bg-surface'
      }`}
      gap={2}
    >
      {isCurve && !isWarning && <CurveLogo className="text-textSecondary mt-[3px] h-4 w-4 shrink-0" />}
      {isWarning && (
        <svg
          className="text-error h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            fill="currentColor"
          />
        </svg>
      )}
      <Text variant="small" className={isWarning ? 'text-error' : 'text-textSecondary'}>
        {(() => {
          // Check if message contains a percentage to style (with optional + sign)
          const percentMatch = message.match(/(\+?\d+\.?\d*%)/);
          if (percentMatch && (isWarningPremium || isHighPremium || isDiscount)) {
            const parts = message.split(percentMatch[0]);
            const percentageColorClass = isDiscount
              ? 'text-bullish'
              : isHighPremium
                ? 'text-error'
                : 'text-amber-400';
            return (
              <>
                {parts[0]}
                <span className={percentageColorClass}>{percentMatch[0]}</span>
                {parts[1]}
              </>
            );
          }
          return message;
        })()}
      </Text>
    </HStack>
  );
}
