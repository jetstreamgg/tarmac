import { Trans } from '@lingui/react/macro';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { type PendleMarketConfig } from '@jetstreamgg/sky-hooks';
import { positionAnimations } from '@widgets/shared/animation/presets';
import { MotionVStack } from '@widgets/shared/components/ui/layout/MotionVStack';

type MaturedRedeemProps = {
  market: PendleMarketConfig;
  ptBalance?: bigint;
  /** User-friendly message for simulation/prepare failure. */
  prepareErrorMessage?: string;
};

/**
 * Matured-market redeem view — strips the widget to a single information
 * banner. There's no input: the action button redeems the user's full PT
 * balance 1:1 (via useBatchPendleRedeemMulticall in the parent widget).
 *
 * 1:1 holds for all PENDLE_MARKETS today (USDG, USDe, sENA — each has SY
 * exchange rate 1.0 to its underlying). If we ever add a market whose SY
 * rate is not 1:1, switch the displayed preview to read SY.previewRedeem
 * on-chain.
 */
export const MaturedRedeem = ({ market, ptBalance, prepareErrorMessage }: MaturedRedeemProps) => {
  const formattedBalance = formatBigInt(ptBalance ?? 0n, {
    unit: market.underlyingDecimals,
    maxDecimals: 4
  });

  return (
    <MotionVStack gap={0} className="w-full" variants={positionAnimations}>
      <div
        className="bg-bullish/10 text-bullish rounded-xl px-3 py-2 text-sm"
        data-testid="pendle-matured-banner"
      >
        <Trans>
          Maturity reached — redeem {formattedBalance} PT-{market.underlyingSymbol} for {formattedBalance}{' '}
          {market.underlyingSymbol}.
        </Trans>
      </div>

      {prepareErrorMessage && (
        <div
          className="bg-error/10 text-error mt-3 rounded-xl px-3 py-2 text-sm"
          data-testid="pendle-prepare-error-banner"
          role="alert"
        >
          {prepareErrorMessage}
        </div>
      )}
    </MotionVStack>
  );
};
