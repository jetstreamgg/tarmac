import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Info } from 'lucide-react';
import { formatBigInt } from '@/utils';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDecimalPercentage } from '@/utils';
import { StakeCardMode } from '../hooks/useStakeManageFlowState';
import { StakeManageCard, StakeManageDeltaRow } from './StakeManageCard';
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

  const formatSky = (value: bigint | null) =>
    value !== null ? `${formatBigInt(value, { compact: true })} SKY` : NO_VALUE;

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
        />

        <div className="border-textSecondary/10 flex items-center justify-between border-b pb-3 text-sm">
          <span className="text-textSecondary">{isStake ? t`Balance:` : t`Staked:`}</span>
          <span className="text-text font-medium" data-testid="stake-manage-stake-base">
            {isStake && walletBalanceLoading ? <Skeleton className="h-4 w-24" /> : formatBigInt(base)}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Slider
            value={[sliderPercent]}
            max={100}
            step={1}
            onValueChange={value => onSliderChange(value[0])}
            aria-label={isStake ? t`Stake percentage` : t`Withdraw percentage`}
            data-testid="stake-manage-stake-slider"
            className="[&_[data-slot=slider-track]]:bg-textSecondary/10"
          />
          <div className="text-textSecondary flex items-center justify-between text-xs">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="flex flex-col">
          <StakeManageDeltaRow
            label={
              <>
                <Trans>Min. stake amount to borrow</Trans>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </>
            }
            current={minStakeToBorrow !== undefined ? `${formatBigInt(minStakeToBorrow)} SKY` : NO_VALUE}
            dataTestId="stake-manage-min-stake"
          />
          <StakeManageDeltaRow
            label={<Trans>SKY Rewards rate</Trans>}
            current={rewardsRate !== null ? formatDecimalPercentage(rewardsRate) : NO_VALUE}
          />
          <StakeManageDeltaRow
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
