import { Trans } from '@lingui/react/macro';
import { RateInfo } from '@/components/product/RateInfo';
import { t } from '@lingui/core/macro';
import { Info } from 'lucide-react';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent } from '@/utils';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider, SliderTicks } from '@/components/ui/slider';
import { RiskMeter } from '@/components/product/RiskMeter';
import { useStakeRiskSlider } from '../hooks/useStakeRiskSlider';
import { BorrowCardMode } from '../hooks/useStakeManageFlowState';
import { BorrowRequirementNotice } from './BorrowRequirementNotice';
import {
  StakeManageCard,
  StakeManageStatCell,
  StakeManageStatDivider,
  UpdatedHourlyBadge
} from './StakeManageCard';
import { StakeTakeoverAmountField, BORROW_PERCENT_CHIPS } from './StakeTakeoverAmountField';
import { NO_VALUE } from '@/lib/constants';
import { formatOraclePrice } from '../lib/formatStakeAmount';

const WAD = 10n ** 18n;

// Badges/Risk dash mapping (comp 1036:213853) — the F3 table-meter levels on
// the shared RiskMeter pill (dashes only, no text; the level name stays on the
// aria-label). This used to redraw the pill chrome by hand off a non-DS palette
// (bullish / orange-400 / error at slightly wrong dash geometry); it now takes
// the one pill and the DS Badges/Risk colors like every other risk surface.
const RISK_DOTS: Record<RiskLevel, { lit: number; color: string }> = {
  [RiskLevel.LOW]: { lit: 1, color: 'bg-riskLow' },
  [RiskLevel.MEDIUM]: { lit: 2, color: 'bg-riskMedium' },
  [RiskLevel.HIGH]: { lit: 3, color: 'bg-riskHigh' },
  [RiskLevel.LIQUIDATION]: { lit: 3, color: 'bg-riskHigh' }
};

// In-card risk value (comp 1036:213950): the text pill on the DS
// components/status colours — StakeTakeoverBorrowCard parity. The dash badge
// below stays the summary strip's rendering (comp 1036:213853).
const RISK_PILL: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-statusSuccess/10 text-statusSuccess',
  [RiskLevel.MEDIUM]: 'bg-statusWarning/10 text-statusWarning',
  [RiskLevel.HIGH]: 'bg-statusError/10 text-statusError',
  [RiskLevel.LIQUIDATION]: 'bg-statusError/10 text-statusError'
};

function RiskPill({ riskLevel }: { riskLevel: RiskLevel }) {
  return (
    <span
      className={cn(
        'font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]',
        RISK_PILL[riskLevel]
      )}
    >
      {capitalizeFirstLetter(riskLevel.toLowerCase())}
    </span>
  );
}

export function RiskBadge({ riskLevel }: { riskLevel: RiskLevel }) {
  const dots = RISK_DOTS[riskLevel];
  return (
    <RiskMeter
      label={capitalizeFirstLetter(riskLevel.toLowerCase())}
      segments={[0, 1, 2].map(dot => (dot < dots.lit ? dots.color : null))}
    />
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
  positionLoading,
  simulatedVault,
  simulationLoading,
  vaultNoBorrow,
  collateralData,
  collateralLoading,
  maxBorrowable,
  maxRepayable,
  usdsBalanceLoading,
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
  /** The vault read backing `existingVault` is in flight — its cells hold skeletons. */
  positionLoading?: boolean;
  simulatedVault: Vault | undefined;
  /** The live simulation is in flight — its dust/max figures hold skeletons. */
  simulationLoading?: boolean;
  vaultNoBorrow: Vault | undefined;
  collateralData: CollateralRiskParameters | undefined;
  /** The collateral-parameters read is in flight — the borrow rate holds a skeleton. */
  collateralLoading?: boolean;
  /** min(debt-ceiling headroom, maxSafeBorrowableIntAmount) — legacy formula. */
  maxBorrowable: bigint;
  /** Legacy calculateMaxRepayable output (dust-gap aware). */
  maxRepayable: bigint;
  /** The USDS balance feeding `maxRepayable` is in flight. */
  usdsBalanceLoading?: boolean;
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
    // Mirror the 100% chip's wipeAll staging (M11): a full-left drag lands on
    // the exact debt, and without wipeAll the launch builds a plain wipe whose
    // accrued-interest remainder strands sub-dust debt (vat dust revert).
    setUsdsToWipe: value =>
      onAmountChange(value, value === existingDebt && maxRepayable === existingDebt && existingDebt > 0n)
  });

  const debtCeilingReached = collateralData?.debtCeilingUtilization === 1;
  const inputDisabled = isRepay ? existingDebt === 0n : minCollateralNotMet || debtCeilingReached;
  const hasAmount = amount > 0n;

  // Always-visible cap next to the "Borrowed:" line (pre-redesign behavior):
  // repay's max is wallet- and dust-aware, and borrow has no slider — and thus
  // no max label — until the position carries debt.
  const maxHint = isRepay ? maxRepayable : minCollateralNotMet ? undefined : maxBorrowable;
  // The hint composes over `?? 0n` fallbacks, so it skeletons while any input
  // read is unresolved.
  const maxHintLoading = isRepay
    ? positionLoading || usdsBalanceLoading
    : positionLoading || collateralLoading || simulationLoading;

  // Compact below md (matching the field's own responsive cut) so the line
  // holds one row on phones; full precision from md up.
  const borrowedValue = (compact: boolean) => {
    const newDebt = simulatedVault?.debtValue;
    return showDeltas && newDebt !== undefined && newDebt !== existingDebt
      ? `${formatBigInt(existingDebt, { compact })} → ${formatBigInt(newDebt, { compact })}`
      : formatBigInt(existingDebt, { compact });
  };

  const onPercentClick = (percent: number) => {
    if (isRepay) {
      if (maxRepayable === 0n) return;
      const raw = percent === 100 ? maxRepayable : ((maxRepayable * BigInt(percent)) / 100n / WAD) * WAD;
      // wipeAll only when the exact-max staging clears the full debt (M11).
      onAmountChange(raw, percent === 100 && maxRepayable === existingDebt && existingDebt > 0n);
      return;
    }
    if (maxBorrowable === 0n) return;
    onAmountChange(((maxBorrowable * BigInt(percent)) / 100n / WAD) * WAD);
  };

  // Delta values (M13): current → simulated, arrow only when they differ.
  const isFullRepay = isRepay && (wipeAll || (hasAmount && amount >= existingDebt));
  const showDeltas = hasAmount || wipeAll;

  const currentRisk = existingVault?.riskLevel;
  const nextRisk = isFullRepay ? null : simulatedVault?.riskLevel;

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
          percentChips={isRepay ? undefined : BORROW_PERCENT_CHIPS}
          disabled={inputDisabled}
          error={error}
          label={isRepay ? <Trans>Repay amount</Trans> : <Trans>Borrow amount</Trans>}
          // The repay 100% chip stages the wei-precise live debt — cap only the
          // DISPLAY (the staged value stays exact for wipeAll/buffer math).
          maxDisplayDecimals={2}
          dataTestId="stake-manage-borrow-amount"
          // Comp 1036:213928 draws the position line above the chips; the max
          // rides along after it so the cap stays visible in the states the
          // slider's right label can't cover (zero-debt borrow, all of repay).
          topRight={
            <>
              <span className="whitespace-nowrap" data-testid="stake-manage-borrowed-line">
                <Trans>Borrowed:</Trans>{' '}
                {positionLoading ? (
                  <Skeleton className="inline-block h-3.5 w-16 align-middle" />
                ) : (
                  <>
                    <span className="md:hidden">{borrowedValue(true)}</span>
                    <span className="max-md:hidden">{borrowedValue(false)}</span>
                  </>
                )}
              </span>
              {/* One pending marker per line: while the Borrowed value is itself a
                  skeleton, a second pill for the max hint reads as a glitch. */}
              {maxHintLoading && !positionLoading ? (
                <>
                  {' '}
                  <Skeleton
                    className="inline-block h-3.5 w-20 align-middle"
                    data-testid="stake-manage-max-hint-loading"
                  />
                </>
              ) : null}
              {!maxHintLoading && maxHint !== undefined && (
                // nowrap per chunk, with an explicit breakable space between
                // them (JSX strips the inter-element newline): on narrow
                // screens the line breaks between the Borrowed and max parts,
                // never mid-hint.
                <>
                  {' '}
                  <span className="whitespace-nowrap" data-testid="stake-manage-max-hint">
                    {'· '}
                    <Trans>max. {formatBigInt(maxHint, { compact: true })} USDS</Trans>
                  </span>
                </>
              )}
            </>
          }
        />

        {(isRepay ? shouldShowSlider && !minCollateralNotMet : !inputDisabled) && (
          <div className="flex flex-col gap-2">
            <Slider
              variant="range"
              value={sliderValue}
              max={100}
              step={1}
              onValueChange={value => handleSliderChange(value[0])}
              aria-label={t`Liquidation risk meter`}
              data-testid="stake-manage-borrow-slider"
            />
            <div className="text-fgSecondary flex items-center gap-4 text-xs">
              {isRepay ? (
                <>
                  <span>0%</span>
                  <SliderTicks variant="range" progress={sliderValue[0]} className="grow" />
                  <span>100%</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    {simulatedVault?.dust !== undefined ? (
                      <Trans>min. {formatBigInt(simulatedVault.dust, { compact: true })} USDS</Trans>
                    ) : simulationLoading ? (
                      <Skeleton className="h-3.5 w-14" />
                    ) : (
                      <Trans>min. {NO_VALUE} USDS</Trans>
                    )}
                  </span>
                  <SliderTicks variant="range" progress={sliderValue[0]} className="grow" />
                  <span className="flex items-center gap-1">
                    {maxHintLoading ? (
                      <Skeleton className="h-3.5 w-14" />
                    ) : (
                      <Trans>max. {formatBigInt(maxBorrowable, { compact: true })} USDS</Trans>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {!isRepay && minCollateralNotMet && (
          <BorrowRequirementNotice
            dataTestId="stake-manage-min-collateral-warning"
            title={<Trans>More SKY needed to borrow</Trans>}
          >
            <Trans>
              The minimum borrow is{' '}
              {simulatedVault?.dust !== undefined
                ? formatBigInt(simulatedVault.dust, { compact: true })
                : NO_VALUE}{' '}
              USDS, which requires at least{' '}
              {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY as
              collateral. You currently have {formatBigInt(currentCollateral)}/
              {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY staked.
            </Trans>
          </BorrowRequirementNotice>
        )}

        {!isRepay && debtCeilingReached && (
          <p className="text-sm text-orange-400">
            <Trans>Debt ceiling reached. Borrowing USDS is temporarily unavailable.</Trans>
          </p>
        )}

        {/* Comp 1036:213936 stat columns: Borrow rate · risk badge · prices,
            hugging cells split by hairlines. */}
        <div className="flex flex-wrap items-start gap-4">
          <StakeManageStatCell
            label={
              <>
                <Trans>Borrow rate</Trans>
                <RateInfo type="sbr" size={12} />
              </>
            }
            current={
              collateralData?.stabilityFee ? (
                formatPercent(collateralData.stabilityFee)
              ) : collateralLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                NO_VALUE
              )
            }
            next={isFullRepay ? '0.00%' : undefined}
            dataTestId="stake-manage-borrow-rate-row"
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={
              <>
                <Trans>Liquidation risk</Trans>
                <Info className="h-3 w-3" aria-hidden />
              </>
            }
            current={
              currentRisk ? (
                <RiskPill riskLevel={currentRisk} />
              ) : positionLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                NO_VALUE
              )
            }
            next={
              showDeltas ? (
                isFullRepay ? (
                  t`No position`
                ) : nextRisk && nextRisk !== currentRisk ? (
                  <RiskPill riskLevel={nextRisk} />
                ) : undefined
              ) : undefined
            }
            dataTestId="stake-manage-risk-row"
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={<Trans>Liquidation price</Trans>}
            current={
              positionLoading && existingVault?.liquidationPrice === undefined ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                formatOraclePrice(existingVault?.liquidationPrice)
              )
            }
            next={
              showDeltas
                ? isFullRepay
                  ? '$0.0'
                  : simulatedVault?.liquidationPrice !== undefined &&
                      simulatedVault.liquidationPrice !== existingVault?.liquidationPrice
                    ? formatOraclePrice(simulatedVault.liquidationPrice)
                    : undefined
                : undefined
            }
            dataTestId="stake-manage-liq-price-row"
          />
          <StakeManageStatDivider />
          <StakeManageStatCell
            label={
              <>
                <Trans>Capped OSM SKY price</Trans>
                <RateInfo type="cappedOsmSkyPrice" size={12} />
              </>
            }
            // Single value on purpose: the OSM price ignores user input (M13).
            current={
              <>
                {(positionLoading || simulationLoading) &&
                (simulatedVault?.delayedPrice ?? existingVault?.delayedPrice) === undefined ? (
                  <Skeleton className="h-4 w-14" />
                ) : (
                  formatOraclePrice(simulatedVault?.delayedPrice ?? existingVault?.delayedPrice)
                )}
                <UpdatedHourlyBadge />
              </>
            }
          />
        </div>
      </div>
    </StakeManageCard>
  );
}
