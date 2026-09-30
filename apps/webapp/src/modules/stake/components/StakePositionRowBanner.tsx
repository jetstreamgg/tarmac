import { MouseEvent, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Trans } from '@lingui/react/macro';
import { RiskLevel, RISK_LEVEL_THRESHOLDS } from '@/hooks';
import { formatUsd } from '@/utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatStakeAmount, formatOraclePrice } from '../lib/formatStakeAmount';
import { isAtRiskOfLiquidation } from '../lib/liquidation';
import { isLiquidatedStakePosition, StakeUserPosition } from '../hooks/useStakeUserPositions';
import { useUrnClaimableRewardsUsd } from '../hooks/useUrnClaimableRewardsUsd';
import { useStakeRowVault } from '../hooks/useStakeRowVault';
import { Skeleton } from '@/components/ui/skeleton';
import { NO_VALUE } from '@/lib/constants';

// The banner body activates the row like any other cell; only the CTAs keep
// their own action, so they must not also open the position.
export function ownAction(action: () => void) {
  return (event: MouseEvent) => {
    event.stopPropagation();
    action();
  };
}

// The reveal wrapper's -mt-0.5 covers the table's 2px row slit; the last carrier takes the table's bottom corners.
// The carrier shares its row's hover tint and completes its focus ring (see ProductTransactionsTable).
const REVEAL_CLASS = '-mt-0.5 overflow-clip';
const CARRIER_CLASS =
  'bg-bgSecondary w-full px-6 pb-5 transition-colors [tr:last-child>td>div>&]:rounded-b-[24px] [tr:hover+tr>td>div>&]:bg-bgTertiary [tr:hover>td>div>&]:bg-bgTertiary [tr:focus-visible+tr>td>div>&]:shadow-[inset_2px_0_0_0_var(--color-fgBrand),inset_-2px_0_0_0_var(--color-fgBrand),inset_0_-2px_0_0_var(--color-fgBrand)]';
// Status infobox inside the cell (comp 3617:193974): red at every tier, icon on the title line.
const INFOBOX_CLASS = 'bg-statusErrorBg flex w-full items-center gap-4 rounded-xl px-5 py-4';
const TITLE_CLASS = 'text-fgPrimary font-circle text-sm leading-4 font-medium';
const BODY_CLASS = 'text-fgSecondary font-graphik text-xs leading-[18px]';

const LIQUIDATION_TIER_THRESHOLD =
  RISK_LEVEL_THRESHOLDS.find(t => t.level === RiskLevel.LIQUIDATION)?.threshold ?? 80;

// Same curve and duration as the card bodies (globals.css --animate-card-expand).
const REVEAL_TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };

/**
 * The banner grows in under its row rather than appearing at full height:
 * the rows paint at the skeleton's height first, then the carrier expands
 * and the table (and everything below it) follows in one motion instead of
 * jumping. The row's hover tint and focus ring live on the carrier, so the
 * clip sits on an outer wrapper and the carrier's own bottom padding stays intact.
 */
function Carrier({ reveal, children }: { reveal: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={REVEAL_CLASS}
      initial={reveal && !reducedMotion ? { height: 0, opacity: 0 } : false}
      animate={{ height: 'auto', opacity: 1 }}
      transition={REVEAL_TRANSITION}
    >
      <div className={CARRIER_CLASS}>{children}</div>
    </motion.div>
  );
}

function Infobox({
  dataTestId,
  title,
  body,
  actions
}: {
  dataTestId: string;
  title: ReactNode;
  body: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Carrier reveal>
      <div data-testid={dataTestId} className={INFOBOX_CLASS}>
        <div className="flex flex-1 flex-col gap-2">
          <p className={cn(TITLE_CLASS, 'flex items-center gap-2')}>
            <TriangleAlert className="text-statusError h-4 w-4 shrink-0" aria-hidden />
            {title}
          </p>
          <p className={BODY_CLASS}>{body}</p>
        </div>
        {actions}
      </div>
    </Carrier>
  );
}

/**
 * Below-row banner for an at-risk or liquidated staking position (Figma
 * 1036:218966): it continues the row's own surface rather than sitting in a
 * card of its own, pulled up over the table's 2px row slit. The vault figures
 * come from the list's own Vat snapshot (`useStakeRowVault`), so the warning
 * variant is decided in the same paint as the row and never pops in late.
 * Liquidated takes precedence — it's a historical fact independent of the
 * current vault read; its banner also quotes the claimable rewards, so it
 * holds a same-height placeholder while that read is in flight instead of
 * flashing a 0.00 refund or shifting the table.
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
  const { data: vault, isLoading: vaultLoading } = useStakeRowVault(position);
  const {
    claimableUsd,
    isLoading: claimableLoading,
    unavailable: claimableUnavailable
  } = useUrnClaimableRewardsUsd(urnAddress);

  if (isLiquidatedStakePosition(position)) {
    // The risk-cell badge already marks the row as liquidated from the pure
    // predicate; hold the banner (which quotes the refund/reward figures) until
    // the reads land so it never flashes a 0.00 refund.
    if (vaultLoading || claimableLoading) {
      return (
        <Carrier reveal={false}>
          <Skeleton
            data-testid="stake-position-liquidated-banner-loading"
            className={cn(INFOBOX_CLASS, 'h-[74px] rounded-xl')}
          />
        </Carrier>
      );
    }

    // A failed claimables read is "unknown", not $0.00.
    const rewardsUsd = claimableUnavailable ? NO_VALUE : formatUsd(claimableUsd);
    const refund = formatStakeAmount(vault?.collateralAmount ?? 0n);

    return (
      <Infobox
        dataTestId="stake-position-liquidated-banner"
        title={<Trans>This position was liquidated</Trans>}
        body={
          <Trans>
            Your {refund} SKY refund and {rewardsUsd} in rewards are still claimable. You can open a new
            position at any time.
          </Trans>
        }
        actions={
          <Button variant="primary" onClick={ownAction(onClaim)} data-testid="stake-liquidated-claim-cta">
            <Trans>Claim</Trans>
          </Button>
        }
      />
    );
  }

  if (vaultLoading) return null;
  if (!isAtRiskOfLiquidation(vault)) return null;

  const formattedLiqPrice = formatOraclePrice(vault?.liquidationPrice);
  const critical = (vault?.liquidationProximityPercentage ?? 0) >= LIQUIDATION_TIER_THRESHOLD;

  return (
    <Infobox
      dataTestId="stake-position-warning-banner"
      title={
        critical ? (
          <Trans>Your position is about to be liquidated</Trans>
        ) : (
          <Trans>Your liquidation risk is very high</Trans>
        )
      }
      body={
        <Trans>
          If SKY drops to {formattedLiqPrice}, this position will be liquidated. Add collateral or repay debt
          to lower the risk.
        </Trans>
      }
      actions={
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
      }
    />
  );
}
