import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { TriangleAlert } from 'lucide-react';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { InfoTooltip } from '@/components/InfoTooltip';
import { useStakeRiskSlider } from '../hooks/useStakeRiskSlider';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { StakeTakeoverAmountField, BORROW_PERCENT_CHIPS } from './StakeTakeoverAmountField';

const NO_VALUE = '–';

// Risk-pill palette on the DS components/status colours (Badge I1036:209777) —
// the same success/warning/error trio the risk meters took in APP-432 item 6.
const RISK_PILL: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-statusSuccess/10 text-statusSuccess',
  [RiskLevel.MEDIUM]: 'bg-statusWarning/10 text-statusWarning',
  [RiskLevel.HIGH]: 'bg-statusError/10 text-statusError',
  [RiskLevel.LIQUIDATION]: 'bg-statusError/10 text-statusError'
};

function StatItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-fgSecondary md:text-textSecondary flex items-center gap-1 text-xs leading-[18px]">
        {label}
      </span>
      <span className="text-text font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px]">
        {children}
      </span>
    </div>
  );
}

/** 32px hairline between the stat columns (comp 1036:209771). */
function StatDivider({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('bg-borderPrimary h-8 w-px shrink-0 justify-self-center', className)} />
  );
}

/**
 * Card 2 · Borrow USDS (Optional, Modal / 10 · 1036:209743): enable toggle,
 * amount + max + percent chips,
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
    // Chips follow the slider's whole-USDS rounding.
    onAmountChange(((maxBorrowable * BigInt(percent)) / 100n / 10n ** 18n) * 10n ** 18n);
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
      <div className="flex flex-col gap-6 md:gap-8">
        {/* Amount block over its hairline (Frame 1597879781, 1036:209752). */}
        <div className="flex flex-col gap-2 md:gap-3">
          <StakeTakeoverAmountField
            tokenSymbol="USDS"
            amount={usdsToBorrow}
            onAmountChange={onAmountChange}
            onPercentClick={onPercentClick}
            percentChips={BORROW_PERCENT_CHIPS}
            disabled={inputDisabled}
            error={error}
            dataTestId="stake-takeover-borrow-amount"
            topRight={
              minCollateralNotMet ? undefined : (
                <Trans>max. {formatBigInt(maxBorrowable, { compact: true })} USDS</Trans>
              )
            }
          />
          <span aria-hidden className="border-borderPrimary border-t" />
        </div>

        {shouldShowSlider && !minCollateralNotMet && (
          <div className="flex flex-col gap-1.5">
            <Slider
              variant="range"
              value={sliderValue}
              max={100}
              step={1}
              onValueChange={value => handleSliderChange(value[0])}
              aria-label="Liquidation risk meter"
              data-testid="stake-takeover-borrow-slider"
            />
            <div className="text-fgSecondary flex items-center gap-4 text-xs leading-[18px]">
              <span className="flex items-center gap-1">
                <Trans>min. {dust !== undefined ? formatBigInt(dust, { compact: true }) : NO_VALUE}</Trans>
                <TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />
              </span>
              <SliderTicks variant="range" progress={sliderValue[0]} className="grow" />
              <span className="flex items-center gap-1">
                <Trans>max. {formatBigInt(maxBorrowable, { compact: true })}</Trans>
                <TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />
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
                  The minimum borrow is {dust !== undefined ? formatBigInt(dust) : NO_VALUE} USDS, which
                  requires at least{' '}
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

        {/* 2×2 on phones (1222:19900), one 4-up row from md (1036:209767). The
            middle divider only exists in the row: `hidden` drops it out of the
            grid's flow entirely, so the mobile 2×2 keeps its centre rule. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:flex md:flex-wrap md:gap-4">
          <StatItem label={<Trans>Borrow rate</Trans>}>
            {collateralData?.stabilityFee ? formatPercent(collateralData.stabilityFee) : NO_VALUE}
          </StatItem>
          <StatDivider />
          <StatItem
            label={
              <>
                <Trans>Liquidation risk</Trans>
                <InfoTooltip
                  iconSize={12}
                  iconClassName="shrink-0"
                  content={
                    hasAmount && simulatedVault?.liquidationPrice
                      ? t`Sky closes your position if SKY's price drops to your liquidation price ($${formatBigInt(simulatedVault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}). Your collateral is sold to repay the debt plus a penalty.`
                      : t`Sky closes your position if SKY's price drops to your liquidation price. Your collateral is sold to repay the debt plus a penalty.`
                  }
                />
              </>
            }
          >
            {riskLevel ? (
              <span
                data-testid="stake-takeover-risk-pill"
                className={cn(
                  'font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]',
                  RISK_PILL[riskLevel]
                )}
              >
                {capitalizeFirstLetter(riskLevel.toLowerCase())}
              </span>
            ) : (
              NO_VALUE
            )}
          </StatItem>
          <StatDivider className="hidden md:block" />
          <StatItem label={<Trans>Liquidation price</Trans>}>
            {hasAmount && simulatedVault?.liquidationPrice
              ? `$${formatBigInt(simulatedVault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              : NO_VALUE}
          </StatItem>
          <StatDivider />
          <StatItem
            label={
              <>
                <Trans>Protocol SKY Price</Trans>
                <InfoTooltip
                  iconSize={12}
                  iconClassName="shrink-0"
                  content={t`Sky uses a stale price that updates hourly to protect the system from short-term manipulation. Your liquidation level and borrow limit are based on this price, not the live market price.`}
                />
              </>
            }
          >
            {simulatedVault?.delayedPrice
              ? `$${formatBigInt(simulatedVault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              : NO_VALUE}
            <span className="bg-glassBadge text-textSecondary font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]">
              <Trans>Updated hourly</Trans>
            </span>
          </StatItem>
        </div>
      </div>
    </StakeTakeoverCard>
  );
}
