import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Check, Info, TriangleAlert } from 'lucide-react';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { useStakeRiskSlider } from '../hooks/useStakeRiskSlider';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { StakeTakeoverAmountField, BORROW_PERCENT_CHIPS } from './StakeTakeoverAmountField';

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
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-fgSecondary md:text-textSecondary text-xs leading-[18px] md:flex md:items-center md:gap-1 md:text-sm md:leading-5">
        {label}
      </span>
      <span className="text-text font-circle flex items-center gap-1.5 text-sm leading-4 font-medium tracking-[-0.28px] md:font-sans md:leading-5 md:tracking-normal">
        {children}
      </span>
    </div>
  );
}

/** Mobile-only 32px hairline between the stat columns (comp 1222:19900). */
function StatDivider() {
  return <span aria-hidden className="bg-borderPrimary h-8 w-px justify-self-center md:hidden" />;
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
      <div className="flex flex-col gap-6 md:gap-5">
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

        {/* Mobile-only hairline below the amount block (comp 1222:19809) —
            the comp draws it above the slider and leaves the stats undivided. */}
        <span aria-hidden className="border-textSecondary/10 -mt-3 border-t md:hidden" />

        {shouldShowSlider && !minCollateralNotMet && (
          <div className="flex flex-col gap-2">
            <Slider
              variant="range"
              value={sliderValue}
              max={100}
              step={1}
              onValueChange={value => handleSliderChange(value[0])}
              aria-label="Liquidation risk meter"
              data-testid="stake-takeover-borrow-slider"
            />
            <div className="text-fgSecondary flex items-center gap-4 text-xs">
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

        <div className="md:border-textSecondary/10 grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:flex md:flex-wrap md:items-start md:gap-6 md:border-t md:pt-4">
          <StatItem label={<Trans>Borrow rate</Trans>}>
            {collateralData?.stabilityFee ? formatPercent(collateralData.stabilityFee) : NO_VALUE}
          </StatItem>
          <StatDivider />
          <StatItem
            label={
              <>
                <Trans>Liquidation risk</Trans>
                <Info
                  className="ml-1 inline h-3 w-3 shrink-0 align-[-2px] md:ml-0 md:h-3.5 md:w-3.5 md:align-baseline"
                  aria-hidden
                />
              </>
            }
          >
            {riskLevel ? (
              <span
                data-testid="stake-takeover-risk-pill"
                className={cn(
                  'font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px] md:h-auto md:px-2 md:py-0.5 md:font-sans md:text-xs md:leading-4 md:tracking-normal',
                  RISK_PILL[riskLevel]
                )}
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
          <StatDivider />
          <StatItem
            label={
              <>
                <Trans>Protocol SKY Price</Trans>
                <Info
                  className="ml-1 inline h-3 w-3 shrink-0 align-[-2px] md:ml-0 md:h-3.5 md:w-3.5 md:align-baseline"
                  aria-hidden
                />
              </>
            }
          >
            {simulatedVault?.delayedPrice
              ? `$${formatBigInt(simulatedVault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
              : NO_VALUE}
            <span className="bg-surfaceAlt text-textSecondary font-circle flex h-[18px] items-center gap-1 rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px] md:h-auto md:px-2 md:py-0.5 md:font-sans md:text-xs md:leading-4 md:font-normal md:tracking-normal">
              <Check className="hidden h-3 w-3 md:block" aria-hidden />
              <Trans>Updated hourly</Trans>
            </span>
          </StatItem>
        </div>
      </div>
    </StakeTakeoverCard>
  );
}
