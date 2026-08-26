import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { formatBigInt, formatUsd } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { InfoTooltip } from '@/components/InfoTooltip';
import { StakeTakeoverCard } from './StakeTakeoverCard';
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
 * over a hairline, a 0–100%-of-balance slider, then the rewards-rate stats. The
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
  /** Shown only when Borrow is enabled (minCollateralForDust). */
  minStakeToBorrow: bigint | undefined;
  error?: string;
}) {
  const onPercentClick = (percent: number) => {
    if (balance === undefined) return;
    onAmountChange(percent === 100 ? balance : (balance * BigInt(percent)) / 100n);
  };

  // Slider ↔ amount share the chips' arithmetic, so dragging to a stop and
  // clicking the matching chip stage the same wei. Held at whole percents (the
  // DS Standard slider's step); an amount typed past the balance pins the thumb
  // at 100 rather than running it off the track.
  //
  // The projection back to a percent must ROUND, not floor. Staging floors
  // (`balance × p / 100`), so on any balance that isn't a round multiple of 100
  // wei — i.e. essentially every real one — flooring here too reads back p − 1:
  // the 25% chip would park the thumb at 24, and every drag step would lag the
  // pointer by one. The extra 1e2 of scale keeps that rounding off the bigint
  // division, which floors regardless.
  const sliderBalance = balance ?? 0n;
  const sliderPercent =
    sliderBalance > 0n ? Math.min(100, Math.round(Number((amount * 10000n) / sliderBalance) / 100)) : 0;

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

        {/* Sliders / Standard (I1036:209724): the share of the wallet balance
            being staked. Inert with no balance to divide by. */}
        <div className="flex flex-col gap-1.5">
          <Slider
            value={[sliderPercent]}
            max={100}
            step={1}
            disabled={sliderBalance === 0n}
            onValueChange={value => {
              const percent = value[0];
              onAmountChange(percent >= 100 ? sliderBalance : (sliderBalance * BigInt(percent)) / 100n);
            }}
            aria-label={t`Share of balance to stake`}
            valueText={`${sliderPercent}%`}
            data-testid="stake-takeover-stake-slider"
          />
          <div className="text-fgSecondary flex items-center gap-4 text-xs leading-[18px]">
            <span>0%</span>
            <SliderTicks progress={sliderPercent} className="grow" />
            <span>100%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <StatItem label={<Trans>SKY Rewards rate</Trans>}>
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
        {minStakeToBorrow !== undefined && (
          <>
            <StatDivider />
            <StatItem
              label={
                <>
                  <Trans>Min. stake to borrow</Trans>
                  <InfoTooltip
                    iconSize={12}
                    iconClassName="shrink-0"
                    content={t`Borrowing USDS is optional, but to use your SKY as collateral, you must stake at least ${formatBigInt(minStakeToBorrow)} SKY.`}
                  />
                </>
              }
            >
              <span data-testid="stake-takeover-min-stake" className="flex items-center gap-1">
                {formatBigInt(minStakeToBorrow)}
                <TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />
              </span>
            </StatItem>
          </>
        )}
      </div>
    </StakeTakeoverCard>
  );
}
