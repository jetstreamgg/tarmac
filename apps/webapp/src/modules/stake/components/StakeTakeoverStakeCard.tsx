import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatBigInt, formatUsd } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTooltip } from '@/components/InfoTooltip';
import { RateInfo } from '@/components/product/RateInfo';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { ReachedBadge } from './StakeManageCard';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';
import { NO_VALUE } from '@/lib/constants';

function StatItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none">
      <span className="text-fgSecondary flex items-center gap-1 text-xs leading-[18px]">{label}</span>
      <span className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px]">
        {children}
      </span>
    </div>
  );
}

/** 32px hairline between the stat columns (comp 1036:209729). */
function StatDivider() {
  return <span aria-hidden className="bg-borderPrimary h-8 w-px shrink-0 self-center" />;
}

/**
 * Card 1 · Stake SKY (Modal / 12, 1036:209703): amount + balance/percent chips
 * over a hairline, then the rewards-rate stats. The
 * `Min. stake to borrow` stat appears only while Borrow is enabled (UX §A.2).
 * Est. annual rewards shows "–" until an amount is entered.
 */
export function StakeTakeoverStakeCard({
  amount,
  onAmountChange,
  balance,
  balanceLoading,
  rewardsRate,
  rateLoading,
  estAnnualRewardsUsd,
  minStakeToBorrow,
  minStakeLoading,
  minStakeReached,
  error
}: {
  amount: bigint;
  onAmountChange: (amount: bigint) => void;
  balance: bigint | undefined;
  balanceLoading?: boolean;
  /** Formatted percentage (e.g. "1.50%") or null while loading/unavailable. */
  rewardsRate: string | null;
  /** The farm-rate read is in flight — the rate/est-rewards cells hold a skeleton. */
  rateLoading?: boolean;
  /**
   * Est. annual rewards in USD; null renders the design's "–" empty marker. The
   * BA Labs rate is a value APR, so this is a SKY-equivalent value rather than a
   * count of the reward token — showing it as one named the wrong token.
   */
  estAnnualRewardsUsd: number | null;
  /** minCollateralForDust — always shown, with a Reached / Not reached badge. */
  minStakeToBorrow: bigint | undefined;
  minStakeLoading?: boolean;
  minStakeReached?: boolean;
  error?: string;
}) {
  const onPercentClick = (percent: number) => {
    if (balance === undefined) return;
    onAmountChange(percent === 100 ? balance : (balance * BigInt(percent)) / 100n);
  };

  return (
    <StakeTakeoverCard step={1} title={<Trans>Stake SKY</Trans>} dataTestId="stake-takeover-stake-card">
      <div className="flex flex-col gap-6 md:gap-5">
        <div className="flex flex-col gap-2 md:gap-3">
          <StakeTakeoverAmountField
            tokenSymbol="SKY"
            amount={amount}
            onAmountChange={onAmountChange}
            onPercentClick={onPercentClick}
            error={error}
            dataTestId="stake-takeover-stake-amount"
            topRight={
              balanceLoading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <Trans>Balance: {balance !== undefined ? formatBigInt(balance) : NO_VALUE} SKY</Trans>
              )
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <StatItem
          label={
            <>
              <Trans>Staking Rewards Rate</Trans>
              <RateInfo type="srr" size={12} />
            </>
          }
        >
          {rewardsRate ?? (rateLoading ? <Skeleton className="h-4 w-14" /> : NO_VALUE)}
        </StatItem>
        <StatDivider />
        <StatItem label={<Trans>Est. annual rewards</Trans>}>
          <span data-testid="stake-takeover-est-rewards" className="flex items-center gap-1">
            {rateLoading && amount > 0n ? (
              <Skeleton className="h-4 w-14" />
            ) : estAnnualRewardsUsd !== null && estAnnualRewardsUsd > 0 ? (
              formatUsd(estAnnualRewardsUsd)
            ) : (
              NO_VALUE
            )}
          </span>
        </StatItem>
        <StatDivider />
        <StatItem
          label={
            <>
              <Trans>Min. stake to borrow</Trans>
              <InfoTooltip
                iconSize={12}
                iconClassName="shrink-0"
                content={
                  minStakeToBorrow !== undefined
                    ? t`Borrowing USDS is optional, but to use your SKY as collateral, you must stake at least ${formatBigInt(minStakeToBorrow)} SKY.`
                    : t`Borrowing USDS is optional, but to use your SKY as collateral, you must stake at least the minimum shown here.`
                }
              />
            </>
          }
        >
          <span data-testid="stake-takeover-min-stake" className="flex items-center gap-1">
            {minStakeToBorrow !== undefined ? (
              <>
                {formatBigInt(minStakeToBorrow)}
                <TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />
              </>
            ) : minStakeLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              NO_VALUE
            )}
          </span>
          {minStakeToBorrow !== undefined && minStakeReached !== undefined && (
            <ReachedBadge reached={minStakeReached} />
          )}
        </StatItem>
      </div>
    </StakeTakeoverCard>
  );
}
