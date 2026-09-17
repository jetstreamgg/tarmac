import { MouseEvent } from 'react';
import { Info } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { useVault, getIlkName } from '@/hooks';
import { formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { formatStakeAmount, formatOraclePrice } from '../lib/formatStakeAmount';
import { isAtRiskOfLiquidation } from '../lib/liquidation';
import { liquidationDropPercent } from '../lib/positionDetail';
import { isLiquidatedStakePosition, StakeUserPosition } from '../hooks/useStakeUserPositions';
import { useUrnClaimableRewardsUsd } from '../hooks/useUrnClaimableRewardsUsd';
import { NO_VALUE } from '@/lib/constants';

// The banner body activates the row like any other cell; only the CTAs keep
// their own action, so they must not also open the position.
function ownAction(action: () => void) {
  return (event: MouseEvent) => {
    event.stopPropagation();
    action();
  };
}

// -mt-0.5 covers the table's 2px row slit; the last carrier takes the table's bottom corners.
// The banner shares its row's hover tint and completes its focus ring (see ProductTransactionsTable).
const BANNER_CLASS =
  'bg-bgSecondary -mt-0.5 flex w-full items-center gap-4 px-6 pb-6 transition-colors [tr:last-child>td>&]:rounded-b-[24px] [tr:hover+tr>td>&]:bg-bgTertiary [tr:hover>td>&]:bg-bgTertiary [tr:focus-visible+tr>td>&]:shadow-[inset_2px_0_0_0_var(--color-fgBrand),inset_-2px_0_0_0_var(--color-fgBrand),inset_0_-2px_0_0_var(--color-fgBrand)]';
const ICON_CLASS = 'text-fgSystemWarning mt-0.5 h-3 w-3 shrink-0 self-start';
const TITLE_CLASS = 'text-fgPrimary font-circle text-sm leading-4 font-medium';
const BODY_CLASS = 'text-fgSecondary font-graphik text-xs leading-[18px]';

/**
 * Below-row banner for an at-risk or liquidated staking position (Figma
 * 1036:218966): it continues the row's own surface rather than sitting in a
 * card of its own, pulled up over the table's 2px row slit. Shares the
 * table's per-row vault read (`useStakeUrnAddress` + `useVault`, same ilk),
 * so mounting this alongside `PositionRiskCell` costs no extra RPC. Liquidated
 * takes precedence — it's a historical fact independent of the current vault
 * read. Either variant waits for its figures to load before rendering, so the
 * banner never flashes a 0.00 refund or a false healthy→warning transition.
 */
export function StakePositionRowBanner({
  position,
  onRemediate,
  onClaim
}: {
  position: StakeUserPosition;
  onRemediate: (action: 'stake' | 'repay') => void;
  onClaim: () => void;
}) {
  const urnAddress = position.urnAddress;
  const { data: vault, isLoading: vaultLoading } = useVault(urnAddress, getIlkName(2));
  const {
    claimableUsd,
    isLoading: claimableLoading,
    unavailable: claimableUnavailable
  } = useUrnClaimableRewardsUsd(urnAddress);

  if (isLiquidatedStakePosition(position)) {
    // The risk-cell badge already marks the row as liquidated from the pure
    // predicate; hold the banner (which quotes the refund/reward figures) until
    // the reads land so it never flashes a 0.00 refund.
    if (vaultLoading || claimableLoading) return null;

    // A failed claimables read is "unknown", not $0.00.
    const rewardsUsd = claimableUnavailable ? NO_VALUE : formatUsd(claimableUsd);
    const refund = formatStakeAmount(vault?.collateralAmount ?? 0n);

    return (
      <div data-testid="stake-position-liquidated-banner" className={BANNER_CLASS}>
        <Info className={ICON_CLASS} aria-hidden />
        <div className="flex flex-1 flex-col gap-2">
          <p className={TITLE_CLASS}>
            <Trans>This position was liquidated</Trans>
          </p>
          <p className={BODY_CLASS}>
            <Trans>
              Your {refund} SKY refund and {rewardsUsd} in rewards are still claimable. You can open a new
              position at any time.
            </Trans>
          </p>
        </div>
        <Button variant="primary" onClick={ownAction(onClaim)} data-testid="stake-liquidated-claim-cta">
          <Trans>Claim</Trans>
        </Button>
      </div>
    );
  }

  if (vaultLoading) return null;
  if (!isAtRiskOfLiquidation(vault)) return null;

  const dropPercent = liquidationDropPercent(vault?.liquidationProximityPercentage);
  const formattedLiqPrice = formatOraclePrice(vault?.liquidationPrice);

  return (
    <div data-testid="stake-position-warning-banner" className={BANNER_CLASS}>
      <Info className={ICON_CLASS} aria-hidden />
      <div className="flex flex-1 flex-col gap-2">
        <p className={TITLE_CLASS}>
          <Trans>Your liquidation buffer dropped to {dropPercent}%</Trans>
        </p>
        <p className={BODY_CLASS}>
          <Trans>
            If SKY drops to {formattedLiqPrice}, this position will be liquidated. Add collateral or repay
            debt to lower the risk.
          </Trans>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="primary"
          size="m"
          onClick={ownAction(() => onRemediate('stake'))}
          data-testid="stake-warning-stake-cta"
        >
          <Trans>Stake SKY</Trans>
        </Button>
        <Button
          variant="secondary"
          size="m"
          onClick={ownAction(() => onRemediate('repay'))}
          data-testid="stake-warning-repay-cta"
        >
          <Trans>Repay debt</Trans>
        </Button>
      </div>
    </div>
  );
}
