import { Trans } from '@lingui/react/macro';
import { RateInfo } from '@/components/product/RateInfo';
import { t } from '@lingui/core/macro';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTooltip } from '@/components/InfoTooltip';
import { RiskMeter } from '@/components/product/RiskMeter';
import { useStakeAmountSlider } from '../hooks/useStakeAmountSlider';
import { BorrowCardMode } from '../hooks/useStakeManageFlowState';
import { BorrowRequirementNotice } from './BorrowRequirementNotice';
import { StakeBorrowSliderRow } from './StakeBorrowSliderRow';
import { StakeMoreToBorrowHint } from './StakeCardToggle';
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

export function RiskPill({ riskLevel, dataTestId }: { riskLevel: RiskLevel; dataTestId?: string }) {
  return (
    <span
      data-testid={dataTestId}
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

/** Neutral pill for the post-full-repay risk cell. */
function RepaidPill() {
  return (
    <span
      data-testid="stake-manage-repaid-pill"
      className="bg-glassBadge text-fgSecondary font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]"
    >
      <Trans>Repaid</Trans>
    </span>
  );
}

/**
 * Manage card 2 · Borrow USDS | Repay USDS (UX 1104:18395 / 1104:20574):
 * segmented mode + toggle, amount field, "Borrowed:" before→after line, the
 * amount slider (borrow: total debt 0 → debt + headroom with a "Borrowed:"
 * tick; repay: 0 → debt with a tick at debt − dust) and the delta rows. Deltas
 * follow any staged change on the position (a stake/unstake moves the risk
 * too), blank while the card carries an error. Full repay renders `Repaid` /
 * `–` / `0.00%`. Repay percent chips stage wipeAll only when the max equals
 * the full debt (M11). Below the min collateral the Borrow switch is disabled
 * behind a "Stake more to borrow" hint; a card already on keeps the notice.
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
  collateralData,
  collateralLoading,
  maxBorrowable,
  maxRepayable,
  usdsBalanceLoading,
  wipeAll,
  minCollateralNotMet,
  minCollateralForDust,
  currentCollateral,
  hasStagedChange,
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
  /** Any staged change on the position (stake, unstake, borrow, repay) — drives the delta rows. */
  hasStagedChange?: boolean;
  error?: string;
}) {
  const isRepay = mode === 'repay';
  const existingDebt = existingVault?.debtValue ?? 0n;
  const dust = existingVault?.dust ?? simulatedVault?.dust;

  const debtCeilingReached = collateralData?.debtCeilingUtilization === 1;
  const slider = useStakeAmountSlider({
    mode: isRepay ? 'repay' : 'borrow',
    existingDebt,
    dust,
    headroom: debtCeilingReached ? 0n : maxBorrowable,
    amount,
    onAmountChange
  });
  const inputDisabled = isRepay ? existingDebt === 0n : minCollateralNotMet || slider.disabled;
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
  const showDeltas = (hasStagedChange ?? (hasAmount || wipeAll)) && !error;

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
      toggleDisabled={!enabled && !isRepay && minCollateralNotMet}
      toggleDisabledHint={
        <StakeMoreToBorrowHint
          title={<Trans>Stake more to borrow</Trans>}
          current={currentCollateral}
          required={minCollateralForDust ?? 0n}
          currentLabel={
            <Trans>
              {formatBigInt(currentCollateral, { compact: true })} /{' '}
              {minCollateralForDust !== undefined
                ? formatBigInt(minCollateralForDust, { compact: true })
                : NO_VALUE}{' '}
              SKY staked
            </Trans>
          }
        />
      }
      dataTestId="stake-manage-borrow-card"
    >
      {/* Design QA 2800:91832 ("More gap", 32px): the amount block, the
          slider and the stats space like the card's own header→body gap. */}
      <div className="flex flex-col gap-6 md:gap-8">
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

        {(isRepay ? !slider.hidden : !minCollateralNotMet) && (
          <StakeBorrowSliderRow
            slider={slider}
            mode={isRepay ? 'repay' : 'borrow'}
            minLoading={dust === undefined && (positionLoading || simulationLoading)}
            maxLoading={isRepay ? positionLoading : maxHintLoading}
            unit="USDS"
            dataTestId="stake-manage-borrow-slider"
          />
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
            hugging cells split by hairlines. 2×2 on phones (the takeover's
            1222:19900 geometry), one row from md — and that row never wraps
            (APP-546): the two oracle prices change precision as the slider
            moves, and a wrapping row flipped between one and two lines under
            the pointer. The cells are nowrap and each carries `min-w-0`, so a
            long value shrinks its neighbours rather than pushing a cell down.
            12px gutters in the row: with a staged delta in the price cell
            (`$0.0125 → $0.0147`) plus the Updated-hourly badge, 16px ones ran
            ~20px into the card's inset (measured at the 610px column). */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4 md:flex md:flex-nowrap md:gap-3">
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
                <InfoTooltip
                  iconSize={12}
                  iconClassName="shrink-0"
                  content={
                    existingVault?.liquidationPrice
                      ? t`Sky closes your position if SKY's price drops to your liquidation price ($${formatBigInt(existingVault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}). Your collateral is sold to repay the debt plus a penalty.`
                      : t`Sky closes your position if SKY's price drops to your liquidation price. Your collateral is sold to repay the debt plus a penalty.`
                  }
                />
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
                  <RepaidPill />
                ) : nextRisk && nextRisk !== currentRisk ? (
                  <RiskPill riskLevel={nextRisk} />
                ) : undefined
              ) : undefined
            }
            dataTestId="stake-manage-risk-row"
          />
          <StakeManageStatDivider className="hidden md:block" />
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
                  ? NO_VALUE
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
