import { Trans } from '@lingui/react/macro';
import { RateInfo } from '@/components/product/RateInfo';
import { t } from '@lingui/core/macro';
import { Info } from 'lucide-react';
import { formatBigInt, formatUsd } from '@/utils';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalPercentage } from '@/utils';
import { StakeCardMode } from '../hooks/useStakeManageFlowState';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { StakeManageCard, StakeManageStatCell, StakeManageStatDivider } from './StakeManageCard';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';
import { NO_VALUE } from '@/lib/constants';

const WAD = 10n ** 18n;

/**
 * Manage card 1 · Stake SKY | Withdraw SKY (UX 1050:21454 / 1104:20574):
 * segmented mode + toggle, amount field, balance/staked line, a 0–100% percent
 * slider over the mode's base amount, and the info rows with before→after
 * deltas (M13/M22). Withdraw validation arrives via `error` (legacy Free.tsx
 * rules, computed in the container).
 */
export function StakeManageStakeCard({
  mode,
  onModeChange,
  enabled,
  onEnabledChange,
  amount,
  onAmountChange,
  walletBalance,
  walletBalanceLoading,
  stakedAmount,
  stakedAmountLoading,
  rewardsRate,
  rateLoading,
  estCurrentUsd,
  estNextUsd,
  minStakeToBorrow,
  minStakeToBorrowLoading,
  error
}: {
  mode: StakeCardMode;
  onModeChange: (mode: StakeCardMode) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  amount: bigint;
  onAmountChange: (amount: bigint) => void;
  walletBalance: bigint | undefined;
  walletBalanceLoading: boolean;
  stakedAmount: bigint | undefined;
  /** The vault read backing `stakedAmount` is in flight — the withdraw base holds a skeleton. */
  stakedAmountLoading?: boolean;
  rewardsRate: number | null;
  /** The farm-rate read is in flight — the rate/est-rewards cells hold a skeleton. */
  rateLoading?: boolean;
  /**
   * Current est. annual rewards (staked × rate), in USD. The BA Labs rate is a
   * value APR, so the projection is a SKY-equivalent value rather than a count
   * of any one token — the same treatment the position details modal and the
   * confirm grid use.
   */
  estCurrentUsd: number | null;
  /** Simulated est. annual rewards once an amount is staged; null = no delta. */
  estNextUsd: number | null;
  minStakeToBorrow: bigint | undefined;
  /** The simulation backing `minStakeToBorrow` is in flight. */
  minStakeToBorrowLoading?: boolean;
  error?: string;
}) {
  const isStake = mode === 'stake';
  const base = (isStake ? walletBalance : stakedAmount) ?? 0n;
  const baseLoading = isStake ? walletBalanceLoading : !!stakedAmountLoading;

  const sliderPercent = base > 0n ? Math.min(100, Number((amount * 100n) / base)) : 0;
  const onSliderChange = (percent: number) => {
    if (base === 0n) return;
    // 100% stages the exact base; intermediate stops round to whole SKY.
    onAmountChange(percent === 100 ? base : ((base * BigInt(percent)) / 100n / WAD) * WAD);
  };
  const onPercentClick = (percent: number) => onSliderChange(percent);

  // Comp values carry a 12px SKY icon instead of the symbol text (1036:213909).
  const skyIcon = (
    <TokenIcon token={{ symbol: 'SKY' }} width={12} className="h-3 w-3" showChainIcon={false} />
  );

  return (
    <StakeManageCard
      modes={[
        { value: 'stake', label: <Trans>Stake SKY</Trans> },
        { value: 'withdraw', label: <Trans>Withdraw SKY</Trans> }
      ]}
      activeMode={mode}
      onModeChange={onModeChange}
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      dataTestId="stake-manage-stake-card"
    >
      <div className="flex flex-col gap-5">
        <StakeTakeoverAmountField
          tokenSymbol="SKY"
          amount={amount}
          onAmountChange={onAmountChange}
          onPercentClick={onPercentClick}
          label={isStake ? <Trans>Staked amount</Trans> : <Trans>Withdraw amount</Trans>}
          error={error}
          maxDisplayDecimals={2}
          dataTestId="stake-manage-stake-amount"
          // Comp 1036:213881: the balance line sits above the chips.
          topRight={
            <span className="flex items-center gap-1" data-testid="stake-manage-stake-base">
              {/* The label is its own flex item so gap-1 spaces both branches
                  alike — a bare trailing space would double up with the gap
                  when the skeleton renders. */}
              <span>{isStake ? t`Balance:` : t`Staked:`}</span>
              {baseLoading ? <Skeleton className="h-4 w-24" /> : formatBigInt(base)}
            </span>
          }
        />

        <div className="flex flex-col gap-2">
          <Slider
            value={[sliderPercent]}
            max={100}
            step={1}
            onValueChange={value => onSliderChange(value[0])}
            aria-label={isStake ? t`Stake percentage` : t`Withdraw percentage`}
            data-testid="stake-manage-stake-slider"
          />
          <div className="text-fgSecondary flex items-center gap-4 text-xs">
            <span>0%</span>
            <SliderTicks progress={sliderPercent} className="grow" />
            <span>100%</span>
          </div>
        </div>

        {/* Comp 1036:213889 stat columns: hugging cells split by hairlines. */}
        <div className="flex flex-wrap items-start gap-4">
          <StakeManageStatCell
            label={
              <>
                <Trans>Min. stake amount to borrow</Trans>
                <Info className="h-3 w-3" aria-hidden />
              </>
            }
            current={
              minStakeToBorrow !== undefined ? (
                <>
                  {formatBigInt(minStakeToBorrow)}
                  {skyIcon}
                </>
              ) : minStakeToBorrowLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                NO_VALUE
              )
            }
            dataTestId="stake-manage-min-stake"
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={
              <>
                <Trans>SKY Rewards rate</Trans>
                <RateInfo type="srr" size={12} />
              </>
            }
            current={
              rewardsRate !== null ? (
                formatDecimalPercentage(rewardsRate)
              ) : rateLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                NO_VALUE
              )
            }
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={<Trans>Est. annual rewards</Trans>}
            current={
              estCurrentUsd === null && (rateLoading || stakedAmountLoading) ? (
                <Skeleton className="h-4 w-14" />
              ) : estCurrentUsd !== null ? (
                formatUsd(estCurrentUsd)
              ) : (
                NO_VALUE
              )
            }
            next={
              estNextUsd !== null && amount > 0n && estNextUsd !== estCurrentUsd
                ? formatUsd(estNextUsd)
                : undefined
            }
            dataTestId="stake-manage-est-rewards"
          />
        </div>
      </div>
    </StakeManageCard>
  );
}
