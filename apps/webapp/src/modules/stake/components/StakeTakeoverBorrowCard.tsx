import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Check, Info, TriangleAlert } from 'lucide-react';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Slider } from '@/components/ui/slider';
import { useStakeRiskSlider } from '../hooks/useStakeRiskSlider';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';

const NO_VALUE = '–';

// Risk-pill palette — same convention as the F3 positions-table meter.
const RISK_PILL: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-bullish/20 text-bullish',
  [RiskLevel.MEDIUM]: 'bg-orange-400/20 text-orange-400',
  [RiskLevel.HIGH]: 'bg-error/20 text-error',
  [RiskLevel.LIQUIDATION]: 'bg-error/20 text-error'
};

function StatItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-textSecondary flex items-center gap-1 text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

/**
 * Card 2 · Borrow USDS (Optional): enable toggle, amount + max + percent chips,
 * the legacy risk slider (math verbatim via useStakeRiskSlider), risk/price
 * stats, and the min-collateral warning state (UX `1104:19793` — input pinned,
 * Confirm handled by the container). Risk/price rows show "–" until an amount
 * is entered (UX §A.2).
 */
export function StakeTakeoverBorrowCard({
  enabled,
  onEnabledChange,
  usdsToBorrow,
  onAmountChange,
  maxBorrowable,
  dust,
  minCollateralNotMet,
  minCollateralForDust,
  skyToLock,
  simulatedVault,
  vaultNoBorrow,
  collateralData,
  error
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  usdsToBorrow: bigint;
  onAmountChange: (amount: bigint) => void;
  /** min(debt-ceiling headroom, maxSafeBorrowableIntAmount) — legacy formula. */
  maxBorrowable: bigint;
  dust: bigint | undefined;
  minCollateralNotMet: boolean;
  minCollateralForDust: bigint | undefined;
  skyToLock: bigint;
  simulatedVault: Vault | undefined;
  vaultNoBorrow: Vault | undefined;
  collateralData: CollateralRiskParameters | undefined;
  error?: string;
}) {
  const { sliderValue, handleSliderChange, shouldShowSlider } = useStakeRiskSlider({
    vault: simulatedVault,
    vaultNoBorrow,
    usdsToBorrow,
    setUsdsToBorrow: onAmountChange,
    usdsToWipe: 0n,
    setUsdsToWipe: () => undefined
  });

  const debtCeilingReached = collateralData?.debtCeilingUtilization === 1;
  const inputDisabled = minCollateralNotMet || debtCeilingReached;
  const hasAmount = usdsToBorrow > 0n;
  const riskLevel = hasAmount ? simulatedVault?.riskLevel : undefined;

  const onPercentClick = (percent: number) => {
    if (maxBorrowable === 0n) return;
    const raw = percent === 100 ? maxBorrowable : (maxBorrowable * BigInt(percent)) / 100n;
    // Chips follow the slider's whole-USDS rounding; 100% is the exact max.
    onAmountChange(percent === 100 ? raw : (raw / 10n ** 18n) * 10n ** 18n);
  };

  return (
    <StakeTakeoverCard
      step={2}
      title={<Trans>Borrow USDS</Trans>}
      optional
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      dataTestId="stake-takeover-borrow-card"
    >
      <div className="flex flex-col gap-5">
        <StakeTakeoverAmountField
          tokenSymbol="USDS"
          amount={usdsToBorrow}
          onAmountChange={onAmountChange}
          onPercentClick={onPercentClick}
          disabled={inputDisabled}
          error={error}
          dataTestId="stake-takeover-borrow-amount"
          topRight={
            minCollateralNotMet ? undefined : (
              <Trans>max. {formatBigInt(maxBorrowable, { compact: true })} USDS</Trans>
            )
          }
        />

        {shouldShowSlider && !minCollateralNotMet && (
          <div className="flex flex-col gap-2">
            <Slider
              value={sliderValue}
              max={100}
              step={1}
              onValueChange={value => handleSliderChange(value[0])}
              aria-label="Liquidation risk meter"
              data-testid="stake-takeover-borrow-slider"
              className="[&_[data-slot=slider-range]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-400"
            />
            <div className="text-textSecondary flex items-center justify-between text-xs">
              <span className="flex items-center gap-1">
                <Trans>min. {dust !== undefined ? formatBigInt(dust, { compact: true }) : NO_VALUE}</Trans>
                <TokenIcon
                  token={{ symbol: 'USDS' }}
                  width={14}
                  className="h-3.5 w-3.5"
                  showChainIcon={false}
                />
              </span>
              <span className="flex items-center gap-1">
                <Trans>max. {formatBigInt(maxBorrowable, { compact: true })}</Trans>
                <TokenIcon
                  token={{ symbol: 'USDS' }}
                  width={14}
                  className="h-3.5 w-3.5"
                  showChainIcon={false}
                />
              </span>
            </div>
          </div>
        )}

        {minCollateralNotMet && (
          <div
            data-testid="stake-takeover-min-collateral-warning"
            className="flex items-start gap-3 rounded-xl border border-orange-400/40 bg-orange-400/10 p-4"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" aria-hidden />
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-text font-medium">
                <Trans>More SKY needed to borrow</Trans>
              </span>
              <span className="text-textSecondary">
                <Trans>
                  The minimum borrow is{' '}
                  {dust !== undefined ? formatBigInt(dust, { compact: true }) : NO_VALUE} USDS, which requires
                  at least{' '}
                  {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY as
                  collateral. You currently have {formatBigInt(skyToLock)}/
                  {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY
                  staked.
                </Trans>
              </span>
            </div>
          </div>
        )}

        {debtCeilingReached && (
          <p className="text-sm text-orange-400">
            <Trans>Debt ceiling reached. Borrowing USDS is temporarily unavailable.</Trans>
          </p>
        )}

        <div className="border-textSecondary/10 flex flex-wrap items-start gap-6 border-t pt-4">
          <StatItem label={<Trans>Borrow rate</Trans>}>
            {collateralData?.stabilityFee ? formatPercent(collateralData.stabilityFee) : NO_VALUE}
          </StatItem>
          <StatItem
            label={
              <>
                <Trans>Liquidation risk</Trans>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </>
            }
          >
            {riskLevel ? (
              <span
                data-testid="stake-takeover-risk-pill"
                className={cn('rounded-full px-2 py-0.5 text-xs font-medium', RISK_PILL[riskLevel])}
              >
                {capitalizeFirstLetter(riskLevel.toLowerCase())}
              </span>
            ) : (
              NO_VALUE
            )}
          </StatItem>
          <StatItem label={<Trans>Liquidation price</Trans>}>
            {hasAmount && simulatedVault?.liquidationPrice
              ? `$${formatBigInt(simulatedVault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              : NO_VALUE}
          </StatItem>
          <StatItem
            label={
              <>
                <Trans>Protocol SKY Price</Trans>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </>
            }
          >
            {simulatedVault?.delayedPrice
              ? `$${formatBigInt(simulatedVault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              : NO_VALUE}
            <span className="bg-surfaceAlt text-textSecondary flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
              <Check className="h-3 w-3" aria-hidden />
              <Trans>Updated hourly</Trans>
            </span>
          </StatItem>
        </div>
      </div>
    </StakeTakeoverCard>
  );
}
