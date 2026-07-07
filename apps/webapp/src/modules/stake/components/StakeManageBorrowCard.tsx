import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Check, Info, TriangleAlert } from 'lucide-react';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Slider } from '@/components/ui/slider';
import { useStakeRiskSlider } from '../hooks/useStakeRiskSlider';
import { BorrowCardMode } from '../hooks/useStakeManageFlowState';
import { StakeManageCard, StakeManageDeltaRow } from './StakeManageCard';
import { StakeTakeoverAmountField } from './StakeTakeoverAmountField';

const NO_VALUE = '–';
const WAD = 10n ** 18n;

// Three-dot risk value (UX B.3 delta rows: `•• Medium → ••• High`) — the F3
// table-meter mapping, unboxed for inline delta rendering.
const RISK_DOTS: Record<RiskLevel, { lit: number; color: string }> = {
  [RiskLevel.LOW]: { lit: 1, color: 'bg-bullish' },
  [RiskLevel.MEDIUM]: { lit: 2, color: 'bg-orange-400' },
  [RiskLevel.HIGH]: { lit: 3, color: 'bg-error' },
  [RiskLevel.LIQUIDATION]: { lit: 3, color: 'bg-error' }
};

export function RiskValue({ riskLevel }: { riskLevel: RiskLevel }) {
  const dots = RISK_DOTS[riskLevel];
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map(dot => (
          <span
            key={dot}
            className={cn(
              'h-1 w-1 rounded-full',
              dot < dots.lit ? dots.color : 'bg-textSecondary/30'
            )}
          />
        ))}
      </span>
      {capitalizeFirstLetter(riskLevel.toLowerCase())}
    </span>
  );
}

/**
 * Manage card 2 · Borrow USDS | Repay USDS (UX 1104:18395 / 1104:20574):
 * segmented mode + toggle, amount field, "Borrowed:" before→after line, the
 * legacy risk slider (borrow: floor at current risk, min-dust/max labels;
 * repay: ceiling at current risk, 0–100% labels), and the delta rows. Full
 * repay renders `No position` / `$0.0` / `0.00%` (M13). Repay percent chips
 * stage wipeAll only when the max equals the full debt (M11).
 */
export function StakeManageBorrowCard({
  mode,
  onModeChange,
  enabled,
  onEnabledChange,
  amount,
  onAmountChange,
  existingVault,
  simulatedVault,
  vaultNoBorrow,
  collateralData,
  maxBorrowable,
  maxRepayable,
  wipeAll,
  minCollateralNotMet,
  minCollateralForDust,
  currentCollateral,
  error
}: {
  mode: BorrowCardMode;
  onModeChange: (mode: BorrowCardMode) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  amount: bigint;
  onAmountChange: (amount: bigint, wipeAll?: boolean) => void;
  existingVault: Vault | undefined;
  simulatedVault: Vault | undefined;
  vaultNoBorrow: Vault | undefined;
  collateralData: CollateralRiskParameters | undefined;
  /** min(debt-ceiling headroom, maxSafeBorrowableIntAmount) — legacy formula. */
  maxBorrowable: bigint;
  /** Legacy calculateMaxRepayable output (dust-gap aware). */
  maxRepayable: bigint;
  wipeAll: boolean;
  minCollateralNotMet: boolean;
  minCollateralForDust: bigint | undefined;
  currentCollateral: bigint;
  error?: string;
}) {
  const isRepay = mode === 'repay';
  const existingDebt = existingVault?.debtValue ?? 0n;

  const { sliderValue, handleSliderChange, shouldShowSlider } = useStakeRiskSlider({
    vault: simulatedVault,
    existingVault,
    vaultNoBorrow,
    isRepayMode: isRepay,
    usdsToBorrow: isRepay ? 0n : amount,
    setUsdsToBorrow: value => onAmountChange(value),
    usdsToWipe: isRepay ? amount : 0n,
    setUsdsToWipe: value => onAmountChange(value)
  });

  const debtCeilingReached = collateralData?.debtCeilingUtilization === 1;
  const inputDisabled = isRepay ? existingDebt === 0n : minCollateralNotMet || debtCeilingReached;
  const hasAmount = amount > 0n;

  const onPercentClick = (percent: number) => {
    if (isRepay) {
      if (maxRepayable === 0n) return;
      const raw = percent === 100 ? maxRepayable : (((maxRepayable * BigInt(percent)) / 100n) / WAD) * WAD;
      // wipeAll only when the exact-max staging clears the full debt (M11).
      onAmountChange(raw, percent === 100 && maxRepayable === existingDebt && existingDebt > 0n);
      return;
    }
    if (maxBorrowable === 0n) return;
    const raw = percent === 100 ? maxBorrowable : (maxBorrowable * BigInt(percent)) / 100n;
    onAmountChange(percent === 100 ? raw : (raw / WAD) * WAD);
  };

  // Delta values (M13): current → simulated, arrow only when they differ.
  const isFullRepay = isRepay && (wipeAll || (hasAmount && amount >= existingDebt));
  const newDebt = simulatedVault?.debtValue;
  const showDeltas = hasAmount || wipeAll;

  const currentRisk = existingVault?.riskLevel;
  const nextRisk = isFullRepay ? null : simulatedVault?.riskLevel;

  const formatPrice = (value: bigint | undefined): ReactNode =>
    value !== undefined ? `$${formatBigInt(value, { unit: WAD_PRECISION, maxDecimals: 4 })}` : NO_VALUE;

  return (
    <StakeManageCard
      modes={[
        { value: 'borrow', label: <Trans>Borrow USDS</Trans> },
        { value: 'repay', label: <Trans>Repay USDS</Trans> }
      ]}
      activeMode={mode}
      onModeChange={onModeChange}
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      dataTestId="stake-manage-borrow-card"
    >
      <div className="flex flex-col gap-5">
        <StakeTakeoverAmountField
          tokenSymbol="USDS"
          amount={amount}
          onAmountChange={value => onAmountChange(value)}
          onPercentClick={onPercentClick}
          disabled={inputDisabled}
          error={error}
          label={isRepay ? <Trans>Repay amount</Trans> : <Trans>Borrow amount</Trans>}
          dataTestId="stake-manage-borrow-amount"
          topRight={
            isRepay ? (
              <Trans>max. {formatBigInt(maxRepayable, { compact: true })} USDS</Trans>
            ) : minCollateralNotMet ? undefined : (
              <Trans>max. {formatBigInt(maxBorrowable, { compact: true })} USDS</Trans>
            )
          }
        />

        <div className="border-textSecondary/10 flex items-center justify-between border-b pb-3 text-sm">
          <span className="text-textSecondary">
            <Trans>Borrowed:</Trans>
          </span>
          <span className="text-text font-medium" data-testid="stake-manage-borrowed-line">
            {showDeltas && newDebt !== undefined && newDebt !== existingDebt
              ? `${formatBigInt(existingDebt)} → ${formatBigInt(newDebt)}`
              : formatBigInt(existingDebt)}
          </span>
        </div>

        {shouldShowSlider && !minCollateralNotMet && (
          <div className="flex flex-col gap-2">
            <Slider
              value={sliderValue}
              max={100}
              step={1}
              onValueChange={value => handleSliderChange(value[0])}
              aria-label={t`Liquidation risk meter`}
              data-testid="stake-manage-borrow-slider"
              className="[&_[data-slot=slider-range]]:bg-orange-400 [&_[data-slot=slider-thumb]]:border-orange-400"
            />
            <div className="text-textSecondary flex items-center justify-between text-xs">
              {isRepay ? (
                <>
                  <span>0%</span>
                  <span>100%</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <Trans>
                      min.{' '}
                      {simulatedVault?.dust !== undefined
                        ? formatBigInt(simulatedVault.dust, { compact: true })
                        : NO_VALUE}{' '}
                      USDS
                    </Trans>
                  </span>
                  <span className="flex items-center gap-1">
                    <Trans>max. {formatBigInt(maxBorrowable, { compact: true })} USDS</Trans>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {!isRepay && minCollateralNotMet && (
          <div
            data-testid="stake-manage-min-collateral-warning"
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
                  {simulatedVault?.dust !== undefined
                    ? formatBigInt(simulatedVault.dust, { compact: true })
                    : NO_VALUE}{' '}
                  USDS, which requires at least{' '}
                  {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY as
                  collateral. You currently have {formatBigInt(currentCollateral)}/
                  {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY
                  staked.
                </Trans>
              </span>
            </div>
          </div>
        )}

        {!isRepay && debtCeilingReached && (
          <p className="text-sm text-orange-400">
            <Trans>Debt ceiling reached. Borrowing USDS is temporarily unavailable.</Trans>
          </p>
        )}

        <div className="flex flex-col">
          <StakeManageDeltaRow
            label={
              <>
                <Trans>Liquidation risk</Trans>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </>
            }
            current={currentRisk ? <RiskValue riskLevel={currentRisk} /> : NO_VALUE}
            next={
              showDeltas
                ? isFullRepay
                  ? t`No position`
                  : nextRisk && nextRisk !== currentRisk
                    ? <RiskValue riskLevel={nextRisk} />
                    : undefined
                : undefined
            }
            dataTestId="stake-manage-risk-row"
          />
          <StakeManageDeltaRow
            label={<Trans>Liquidation price</Trans>}
            current={formatPrice(existingVault?.liquidationPrice)}
            next={
              showDeltas
                ? isFullRepay
                  ? '$0.0'
                  : simulatedVault?.liquidationPrice !== undefined &&
                      simulatedVault.liquidationPrice !== existingVault?.liquidationPrice
                    ? formatPrice(simulatedVault.liquidationPrice)
                    : undefined
                : undefined
            }
            dataTestId="stake-manage-liq-price-row"
          />
          <StakeManageDeltaRow
            label={
              <>
                <Trans>Protocol SKY Price</Trans>
                <Info className="h-3.5 w-3.5" aria-hidden />
              </>
            }
            // Single value on purpose: the OSM price ignores user input (M13).
            current={
              <>
                {formatPrice(simulatedVault?.delayedPrice ?? existingVault?.delayedPrice)}
                <span className="bg-surfaceAlt text-textSecondary flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                  <Check className="h-3 w-3" aria-hidden />
                  <Trans>Updated hourly</Trans>
                </span>
              </>
            }
          />
          <StakeManageDeltaRow
            label={<Trans>Borrow rate</Trans>}
            current={collateralData?.stabilityFee ? formatPercent(collateralData.stabilityFee) : NO_VALUE}
            next={isFullRepay ? '0.00%' : undefined}
            dataTestId="stake-manage-borrow-rate-row"
          />
        </div>
      </div>
    </StakeManageCard>
  );
}
