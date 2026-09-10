import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { RiskLevel, Vault, CollateralRiskParameters } from '@/hooks';
import { capitalizeFirstLetter, formatBigInt, formatPercent, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { InfoTooltip } from '@/components/InfoTooltip';
import { RateInfo } from '@/components/product/RateInfo';
import { useStakeAmountSlider } from '../hooks/useStakeAmountSlider';
import { BorrowRequirementNotice } from './BorrowRequirementNotice';
import { StakeBorrowSliderRow } from './StakeBorrowSliderRow';
import { StakeMoreToBorrowHint } from './StakeCardToggle';
import { StakeTakeoverCard } from './StakeTakeoverCard';
import { StakeTakeoverAmountField, AmountChip } from './StakeTakeoverAmountField';
import { NO_VALUE } from '@/lib/constants';
import { formatOraclePrice } from '../lib/formatStakeAmount';

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
    // nowrap from md: the row below never breaks there (APP-546), so a value
    // must not fold onto a second line inside its cell either. Phones keep
    // the 2×2 grid, whose narrow tracks need the wrap.
    <div className="flex min-w-0 flex-col gap-1 md:whitespace-nowrap">
      <span className="text-fgSecondary flex items-center gap-1 text-xs leading-[18px]">{label}</span>
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
 * amount + max + percent chips, the amount slider (0 → max, min-dust label),
 * risk/price stats. Below the min collateral the switch is disabled behind a
 * "Stake more to borrow" hint; a card already on keeps the notice (input
 * pinned, Confirm handled by the container). Risk/price rows show "–" until
 * an amount is entered (UX §A.2).
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
  simulationLoading,
  collateralData,
  collateralLoading,
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
  /** The simulation is in flight — its dust/max/risk figures hold skeletons. */
  simulationLoading?: boolean;
  collateralData: CollateralRiskParameters | undefined;
  /** The collateral-parameters read is in flight — the borrow rate holds a skeleton. */
  collateralLoading?: boolean;
  error?: string;
}) {
  const debtCeilingReached = collateralData?.debtCeilingUtilization === 1;
  const slider = useStakeAmountSlider({
    mode: 'borrow',
    existingDebt: 0n,
    dust,
    headroom: debtCeilingReached ? 0n : maxBorrowable,
    amount: usdsToBorrow,
    onAmountChange
  });
  const inputDisabled = minCollateralNotMet || slider.disabled;
  const hasAmount = usdsToBorrow > 0n;
  const riskLevel = hasAmount ? simulatedVault?.riskLevel : undefined;
  // `maxBorrowable` composes over `?? 0n` fallbacks, so it skeletons while
  // either input read is unresolved.
  const maxLoading = collateralLoading || simulationLoading;

  // Figma 3015:59004 chips: Min stages the dust floor, Max the full headroom.
  const chips: AmountChip[] = [
    { key: 'chip-min', label: t`Min`, onClick: () => dust !== undefined && onAmountChange(dust) },
    { key: 'chip-max', label: t`Max`, onClick: () => maxBorrowable > 0n && onAmountChange(maxBorrowable) }
  ];

  return (
    <StakeTakeoverCard
      step={3}
      title={<Trans>Borrow USDS</Trans>}
      optional
      enabled={enabled}
      onEnabledChange={onEnabledChange}
      toggleDisabled={!enabled && minCollateralNotMet}
      toggleDisabledHint={
        <StakeMoreToBorrowHint
          title={<Trans>Stake more to borrow</Trans>}
          current={skyToLock}
          required={minCollateralForDust ?? 0n}
          currentLabel={
            <Trans>
              {formatBigInt(skyToLock, { compact: true })} /{' '}
              {minCollateralForDust !== undefined
                ? formatBigInt(minCollateralForDust, { compact: true })
                : NO_VALUE}{' '}
              SKY staked
            </Trans>
          }
        />
      }
      dataTestId="stake-takeover-borrow-card"
    >
      <div className="flex flex-col gap-6 md:gap-8">
        {/* Amount block over its hairline (Frame 1597879781, 1036:209752). */}
        <div className="flex flex-col gap-2 md:gap-3">
          <StakeTakeoverAmountField
            tokenSymbol="USDS"
            amount={usdsToBorrow}
            onAmountChange={onAmountChange}
            chips={chips}
            disabled={inputDisabled}
            error={error}
            dataTestId="stake-takeover-borrow-amount"
            topRight={
              minCollateralNotMet ? undefined : maxLoading ? (
                <Skeleton className="h-4 w-24" data-testid="stake-takeover-max-loading" />
              ) : (
                <Trans>max. {formatBigInt(maxBorrowable, { compact: true })} USDS</Trans>
              )
            }
          />
        </div>

        {!minCollateralNotMet && (
          <StakeBorrowSliderRow
            slider={slider}
            mode="borrow"
            minLoading={dust === undefined && simulationLoading}
            maxLoading={maxLoading}
            unit={
              <TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />
            }
            dataTestId="stake-takeover-borrow-slider"
          />
        )}

        {minCollateralNotMet && (
          <BorrowRequirementNotice
            dataTestId="stake-takeover-min-collateral-warning"
            title={<Trans>More SKY needed to borrow</Trans>}
          >
            <Trans>
              The minimum borrow is {dust !== undefined ? formatBigInt(dust) : NO_VALUE} USDS, which requires
              at least {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE}{' '}
              SKY as collateral. You currently have {formatBigInt(skyToLock)}/
              {minCollateralForDust !== undefined ? formatBigInt(minCollateralForDust) : NO_VALUE} SKY staked.
            </Trans>
          </BorrowRequirementNotice>
        )}

        {debtCeilingReached && (
          <p className="text-sm text-orange-400">
            <Trans>Debt ceiling reached. Borrowing USDS is temporarily unavailable.</Trans>
          </p>
        )}

        {/* 2×2 on phones (1222:19900), one 4-up row from md (1036:209767). The
            middle divider only exists in the row: `hidden` drops it out of the
            grid's flow entirely, so the mobile 2×2 keeps its centre rule. The
            row never wraps (APP-546): the oracle prices change width as the
            slider moves, and a wrapping row flipped between one and two
            lines under the pointer. */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 md:flex md:flex-nowrap md:gap-4">
          <StatItem
            label={
              <>
                <Trans>Borrow rate</Trans>
                <RateInfo type="sbr" size={12} />
              </>
            }
          >
            {collateralData?.stabilityFee ? (
              formatPercent(collateralData.stabilityFee)
            ) : collateralLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              NO_VALUE
            )}
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
            ) : hasAmount && simulationLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              NO_VALUE
            )}
          </StatItem>
          <StatDivider className="hidden md:block" />
          <StatItem label={<Trans>Liquidation price</Trans>}>
            {hasAmount && simulatedVault?.liquidationPrice ? (
              formatOraclePrice(simulatedVault.liquidationPrice)
            ) : hasAmount && simulationLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              NO_VALUE
            )}
          </StatItem>
          <StatDivider />
          <StatItem
            label={
              <>
                <Trans>Capped OSM SKY price</Trans>
                <RateInfo type="cappedOsmSkyPrice" size={12} />
              </>
            }
          >
            {simulatedVault?.delayedPrice ? (
              formatOraclePrice(simulatedVault.delayedPrice)
            ) : simulationLoading ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              NO_VALUE
            )}
            <span className="bg-glassBadge text-fgSecondary font-circle flex h-[18px] items-center rounded-full px-1.5 text-[11px] leading-3 font-medium tracking-[-0.22px]">
              <Trans>Updated hourly</Trans>
            </span>
          </StatItem>
        </div>
      </div>
    </StakeTakeoverCard>
  );
}
