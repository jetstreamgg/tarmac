import { msg } from '@lingui/core/macro';
import type { I18n } from '@lingui/core';
import { StUsdsSelectionReason, StUsdsBlockedReason } from '@/hooks';
import { formatBigInt } from '@/utils';
import type { StUsdsLaunchFlow } from '../hooks/useStUsdsLaunch';

// Premium thresholds for color changes (percent) — carried over from the
// retired StUSDSWidget so the routing copy behaves identically.
export const STUSDS_PREMIUM_WARNING_THRESHOLD = 2; // Yellow warning above 2%
export const STUSDS_PREMIUM_HIGH_THRESHOLD = 10; // Red/high premium above 10%

// Price impact thresholds (basis points)
export const MAX_PRICE_IMPACT_BPS_WITHOUT_WARNING = 200; // 2% - requires user confirmation
export const PRICE_IMPACT_WARNING_THRESHOLD_BPS = 500; // 5% - amber warning color
export const PRICE_IMPACT_HIGH_THRESHOLD_BPS = 3000; // 30% - red error color

/**
 * The user-facing explanation of why a transaction is routed through Curve (or
 * why no route is available) — moved verbatim from the retired StUSDSWidget's
 * `getProviderMessage`.
 */
export function getProviderMessage(
  selectionReason: StUsdsSelectionReason,
  rateDifferencePercent: number,
  flow: StUsdsLaunchFlow,
  nativeBlockedReason: StUsdsBlockedReason | undefined,
  nativeMaxAmount: bigint | undefined,
  i18n: I18n
): string {
  switch (selectionReason) {
    //all blocked - this should only happen if the curve pool is unusable and native is blocked
    case StUsdsSelectionReason.ALL_BLOCKED:
      return i18n._(msg`Both native and Curve routes are temporarily unavailable`);

    //curve better rate
    case StUsdsSelectionReason.CURVE_BETTER_RATE: {
      const rateText = Math.abs(rateDifferencePercent).toFixed(2);
      return `${i18n._(msg`Routing through Curve for a better rate`)} (+${rateText}%)`;
    }

    //curve only available
    case StUsdsSelectionReason.CURVE_ONLY_AVAILABLE:
      switch (nativeBlockedReason) {
        // Fully exhausted - no native capacity at all
        case StUsdsBlockedReason.SUPPLY_CAPACITY_REACHED: {
          const rateText = Math.abs(rateDifferencePercent).toFixed(2);
          if (rateDifferencePercent < 0) {
            return i18n._(
              msg`Routing through Curve with a ${rateText}% premium, as the supply capacity is reached`
            );
          } else if (rateDifferencePercent > 0) {
            return `${i18n._(msg`Routing through Curve for a better rate`)} (+${rateText}%)`;
          } else {
            return i18n._(msg`Routing through Curve, as the supply capacity is reached`);
          }
        }

        // Amount exceeds capacity - user could reduce amount
        case StUsdsBlockedReason.AMOUNT_EXCEEDS_SUPPLY_CAPACITY: {
          const rateText = Math.abs(rateDifferencePercent).toFixed(2);
          if (rateDifferencePercent > 0) {
            return `${i18n._(msg`Routing through Curve for a better rate`)} (+${rateText}%)`;
          }
          if (nativeMaxAmount === undefined) {
            return i18n._(
              msg`Routing through Curve with a ${rateText}% premium, as the supply capacity is reached`
            );
          }
          const maxAmountText = formatBigInt(nativeMaxAmount, { compact: true });
          return i18n._(
            msg`Routing through Curve with a ${rateText}% premium. Avoid the premium by supplying ${maxAmountText} USDS (the remaining native capacity) or less.`
          );
        }

        // Fully exhausted - no native liquidity at all
        case StUsdsBlockedReason.LIQUIDITY_EXHAUSTED: {
          const rateText = Math.abs(rateDifferencePercent).toFixed(2);
          if (rateDifferencePercent < 0) {
            return i18n._(
              msg`Routing through Curve with a ${rateText}% premium, as the liquidity is exhausted`
            );
          } else if (rateDifferencePercent > 0) {
            return `${i18n._(msg`Routing through Curve for a better rate`)} (+${rateText}%)`;
          } else {
            return i18n._(msg`Routing through Curve, as the liquidity is exhausted`);
          }
        }

        // Amount exceeds liquidity - user could reduce amount
        case StUsdsBlockedReason.AMOUNT_EXCEEDS_LIQUIDITY: {
          const rateText = Math.abs(rateDifferencePercent).toFixed(2);
          if (rateDifferencePercent > 0) {
            return `${i18n._(msg`Routing through Curve for a better rate`)} (+${rateText}%)`;
          }
          if (nativeMaxAmount === undefined) {
            return i18n._(
              msg`Routing through Curve with a ${rateText}% premium, as the liquidity is exhausted`
            );
          }
          const maxAmountText = formatBigInt(nativeMaxAmount, { compact: true });
          return i18n._(
            msg`Routing through Curve with a ${rateText}% premium. Avoid the premium by withdrawing ${maxAmountText} USDS (the available native liquidity) or less.`
          );
        }

        default:
          return flow === 'supply'
            ? i18n._(msg`Routing through Curve - native supply unavailable`)
            : i18n._(msg`Routing through Curve - native withdrawals unavailable`);
      }

    // These cases should never occur because the provider notice doesn't render when native is selected
    case StUsdsSelectionReason.NATIVE_ONLY_AVAILABLE:
    case StUsdsSelectionReason.NATIVE_BETTER_RATE:
    case StUsdsSelectionReason.NATIVE_DEFAULT:
      throw new Error(`Unexpected selection reason for provider message: ${selectionReason}`);
  }
}
