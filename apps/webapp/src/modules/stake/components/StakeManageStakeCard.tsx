import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Info } from 'lucide-react';
import { formatBigInt } from '@/utils';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalPercentage } from '@/utils';
import { StakeCardMode } from '../hooks/useStakeManageFlowState';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { StakeManageCard, StakeManageStatCell, StakeManageStatDivider } from './StakeManageCard';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';

const NO_VALUE = '–';
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
  rewardsRate,
  estCurrentSky,
  estNextSky,
  minStakeToBorrow,
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
  rewardsRate: number | null;
  /** Current est. annual rewards (staked × rate), in SKY. */
  estCurrentSky: bigint | null;
  /** Simulated est. annual rewards once an amount is staged; null = no delta. */
  estNextSky: bigint | null;
  minStakeToBorrow: bigint | undefined;
  error?: string;
}) {
  const isStake = mode === 'stake';
  const base = (isStake ? walletBalance : stakedAmount) ?? 0n;

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
  const formatSky = (value: bigint | null) =>
    value !== null ? (
      <>
        {formatBigInt(value, { compact: true })}
        {skyIcon}
      </>
    ) : (
      NO_VALUE
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
              {isStake && walletBalanceLoading ? <Skeleton className="h-4 w-24" /> : formatBigInt(base)}
            </span>
          }
        />

        <div className="bg-borderPrimary h-px w-full" aria-hidden />

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
              ) : (
                NO_VALUE
              )
            }
            dataTestId="stake-manage-min-stake"
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={<Trans>SKY Rewards rate</Trans>}
            current={rewardsRate !== null ? formatDecimalPercentage(rewardsRate) : NO_VALUE}
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={<Trans>Est. annual rewards</Trans>}
            current={formatSky(estCurrentSky)}
            next={
              estNextSky !== null && amount > 0n && estNextSky !== estCurrentSky
                ? formatSky(estNextSky)
                : undefined
            }
            dataTestId="stake-manage-est-rewards"
          />
        </div>
      </div>
    </StakeManageCard>
  );
}
