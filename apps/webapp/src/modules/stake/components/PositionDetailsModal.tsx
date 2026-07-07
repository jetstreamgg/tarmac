import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  ArrowUpFromLine,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Gem,
  HandCoins,
  RefreshCcw,
  UserRound,
  X,
  XCircle
} from 'lucide-react';
import { RISK_LEVEL_THRESHOLDS, RiskLevel, ZERO_ADDRESS } from '@/hooks';
import { formatBigInt, formatUsd, formatPercent, formatDecimalPercentage } from '@/utils';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { liquidationDropPercent } from '../lib/positionDetail';
import { useStakePositionDetail } from '../hooks/useStakePositionDetail';

const NO_VALUE = '–';

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

/** The manage actions F5 implements — rows/CTAs route these to the sheet. */
export type StakeManageAction = 'stake' | 'withdraw' | 'borrow' | 'repay' | 'delegate';

// F4 risk pill palette (StakeTakeoverBorrowCard parity).
const RISK_PILL_COLOR: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-bullish/15 text-bullish',
  [RiskLevel.MEDIUM]: 'bg-orange-400/15 text-orange-400',
  [RiskLevel.HIGH]: 'bg-error/15 text-error',
  [RiskLevel.LIQUIDATION]: 'bg-error/15 text-error'
};
const RISK_FILL_COLOR: Record<RiskLevel, string> = {
  [RiskLevel.LOW]: 'bg-bullish',
  [RiskLevel.MEDIUM]: 'bg-orange-400',
  [RiskLevel.HIGH]: 'bg-error',
  [RiskLevel.LIQUIDATION]: 'bg-error'
};

function StatCell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">{children}</span>
    </div>
  );
}

/**
 * Read-only liquidation-zone indicator (hi-fi 486:32508): a full-width track
 * whose fill is the vault's liquidation proximity, tinted by risk level, with
 * the canonical zone thresholds (0/25/40/80) ticked and labeled beneath.
 * Non-interactive by design — the same scale the risk slider drags along.
 */
function LiquidationZoneIndicator({
  proximityPercentage,
  riskLevel
}: {
  proximityPercentage: number | undefined;
  riskLevel: RiskLevel | undefined;
}) {
  const fill = Math.min(100, Math.max(0, proximityPercentage ?? 0));
  const zones = [...RISK_LEVEL_THRESHOLDS].sort((a, b) => a.threshold - b.threshold);
  const zoneLabel: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: t`Low`,
    [RiskLevel.MEDIUM]: t`Medium`,
    [RiskLevel.HIGH]: t`High`,
    [RiskLevel.LIQUIDATION]: t`Liquidation`
  };

  return (
    <div data-testid="stake-position-risk-indicator" className="flex flex-col gap-2" aria-hidden>
      <div className="bg-textSecondary/20 relative h-1 w-full rounded-full">
        <div
          className={cn('h-1 rounded-full', riskLevel ? RISK_FILL_COLOR[riskLevel] : 'bg-textSecondary/40')}
          style={{ width: `${fill}%` }}
        />
        {zones
          .filter(zone => zone.threshold > 0)
          .map(zone => (
            <span
              key={zone.level}
              className="bg-textSecondary/40 absolute top-1/2 h-3 w-px -translate-y-1/2"
              style={{ left: `${zone.threshold}%` }}
            />
          ))}
      </div>
      <div className="relative h-4 w-full">
        {zones.map(zone => (
          <span
            key={zone.level}
            className="text-textSecondary absolute text-xs"
            style={
              zone.level === RiskLevel.LIQUIDATION
                ? { right: 0 }
                : { left: `${zone.threshold}%`, transform: zone.threshold > 0 ? 'translateX(-50%)' : 'none' }
            }
          >
            {zoneLabel[zone.level]}
          </span>
        ))}
      </div>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  chip,
  disabled = false,
  onClick,
  dataTestId
}: {
  icon: ReactNode;
  label: ReactNode;
  chip?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  dataTestId: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={dataTestId}
      className="border-textSecondary/10 group flex w-full items-center justify-between gap-3 border-b py-4 text-left disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="text-text flex items-center gap-3 text-sm font-medium">
        <span className="text-textSecondary flex h-5 w-5 items-center justify-center" aria-hidden>
          {icon}
        </span>
        {label}
        {chip}
      </span>
      <ChevronRight
        className="text-textSecondary h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </button>
  );
}

/**
 * Position-details modal (F5, hi-fi 486:32508 / UX 1050:20860 + 1050:21185;
 * F6 inactive variants 1194:20561 + 1194:21273): two panels — left is the
 * read-only position detail (heroes, stat grid, liquidation-zone indicator +
 * warning, bottom stat strip), right is the contextual "Manage position" menu.
 * Menu composition follows the debt state; an emptied urn gets the `Inactive`
 * chip, a history-dependent zeroed borrow block, mostly-disabled menu rows and
 * the single `Reopen position` CTA. The undesigned `Change reward` /
 * `Close position` flows render disabled — flagged on APP-312, not improvised.
 */
export function PositionDetailsModal({
  urnIndex,
  onClose,
  onAction,
  onClaim,
  onReopen
}: {
  urnIndex: number;
  onClose: () => void;
  onAction: (action: StakeManageAction) => void;
  /** Opens the claim-rewards modal (F6) — row enabled while something is claimable. */
  onClaim: () => void;
  /** Reopen CTA on inactive urns (C17): borrow-expanded iff the urn ever had debt. */
  onReopen: (borrowExpanded: boolean) => void;
}) {
  const detail = useStakePositionDetail(urnIndex);
  const { vault, hasDebt, isInactive } = detail;
  // The borrow block on an INACTIVE urn follows its history, not its (zero)
  // debt (C15); active urns keep the F5 behavior (block iff current debt).
  const showInactiveBorrowBlock = isInactive && detail.hasBorrowHistory;

  const dropPercent = liquidationDropPercent(vault?.liquidationProximityPercentage);
  const formattedLiqPrice =
    vault?.liquidationPrice !== undefined ? `$${formatBigInt(vault.liquidationPrice)}` : NO_VALUE;
  const hasDelegate = !!detail.voteDelegate && detail.voteDelegate !== ZERO_ADDRESS;

  const claimDisabled = detail.claimableLoading || detail.claimableTokenAmount === 0n;
  const claimChip =
    detail.claimableTokenAmount > 0n ? (
      <span className="bg-surfaceAlt text-text flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
        {formatBigInt(detail.claimableTokenAmount)} {detail.claimableSymbols[0]}
        <TokenIcon
          token={{ symbol: detail.claimableSymbols[0] }}
          width={12}
          className="h-3 w-3"
          showChainIcon={false}
        />
      </span>
    ) : undefined;

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        data-testid="stake-position-details"
        className="bg-containerDark flex max-h-[90vh] w-full flex-col gap-0 overflow-y-auto p-0 sm:min-w-0 lg:max-w-[1042px] lg:flex-row"
        onOpenAutoFocus={event => event.preventDefault()}
      >
        {/* Left panel — read-only position detail */}
        <div className="flex flex-1 flex-col gap-6 p-8">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-text flex items-center gap-2 text-lg font-medium">
              <Trans>Position {urnIndex + 1}</Trans>
              {isInactive && (
                <span
                  data-testid="stake-position-inactive-chip"
                  className="bg-surfaceAlt text-textSecondary rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  <Trans>Inactive</Trans>
                </span>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t`Close`}
              data-testid="stake-position-details-close"
              className="bg-surfaceAlt h-9 w-9 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-textSecondary text-sm">
              <Trans>Staked amount</Trans>
            </span>
            <span className="text-text flex items-baseline gap-2 text-4xl font-medium tracking-tight">
              <TokenIcon
                token={{ symbol: 'SKY' }}
                width={32}
                className="h-8 w-8 self-center"
                showChainIcon={false}
              />
              {detail.vaultLoading ? (
                <Skeleton className="h-9 w-40" />
              ) : (
                formatStakeAmount(vault?.collateralAmount ?? 0n)
              )}
              <span className="text-textSecondary text-sm font-normal">
                {detail.stakedUsd !== null ? `(~${formatUsd(detail.stakedUsd)})` : ''}
              </span>
            </span>
          </div>

          <div className="border-textSecondary/10 grid grid-cols-2 gap-x-5 gap-y-4 border-y py-4 sm:grid-cols-3">
            <StatCell label={<Trans>Rewards rate</Trans>}>
              {detail.rewardsRate !== null ? formatDecimalPercentage(detail.rewardsRate) : NO_VALUE}
            </StatCell>
            <StatCell label={<Trans>Reward token</Trans>}>
              {detail.rewardSymbol ? (
                <>
                  <TokenIcon
                    token={{ symbol: detail.rewardSymbol }}
                    width={16}
                    className="h-4 w-4"
                    showChainIcon={false}
                  />
                  {detail.rewardSymbol}
                </>
              ) : (
                NO_VALUE
              )}
            </StatCell>
            <StatCell label={<Trans>Delegating to</Trans>}>
              {hasDelegate ? (
                <a
                  href={`https://vote.sky.money/address/${detail.voteDelegate!.toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="stake-position-delegate-link"
                  className="hover:text-text flex items-center gap-1"
                >
                  {shortenAddress(detail.voteDelegate!)}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                NO_VALUE
              )}
            </StatCell>
            <StatCell label={<Trans>Claimable rewards</Trans>}>
              {detail.claimableLoading ? (
                <Skeleton className="h-4 w-14" />
              ) : (
                <>
                  {formatUsd(detail.claimableUsd)}
                  {detail.claimableSymbols.map(symbol => (
                    <TokenIcon
                      key={symbol}
                      token={{ symbol }}
                      width={16}
                      className="h-4 w-4"
                      showChainIcon={false}
                    />
                  ))}
                </>
              )}
            </StatCell>
            <StatCell label={<Trans>Est. annual rewards</Trans>}>
              {isInactive ? (
                // Nothing staked accrues nothing — the frame shows a flat $0.00.
                formatUsd(0)
              ) : detail.estAnnualRewardsSky !== null && detail.skyPriceUsd !== null ? (
                <span className="text-bullish flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  {`+${formatUsd((Number(detail.estAnnualRewardsSky / 10n ** 12n) / 1e6) * detail.skyPriceUsd)}`}
                </span>
              ) : (
                NO_VALUE
              )}
            </StatCell>
            <StatCell label={<Trans>Rewards earned</Trans>}>
              <span className="text-bullish flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                {`+${formatUsd(detail.rewardsEarnedUsd)}`}
              </span>
            </StatCell>
          </div>

          {showInactiveBorrowBlock && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-textSecondary text-sm">
                  <Trans>Borrowed amount</Trans>
                </span>
                <span className="text-text flex items-baseline gap-2 text-4xl font-medium tracking-tight">
                  <TokenIcon
                    token={{ symbol: 'USDS' }}
                    width={32}
                    className="h-8 w-8 self-center"
                    showChainIcon={false}
                  />
                  {formatStakeAmount(0n)}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-textSecondary text-sm">
                  <Trans>Liquidation risk</Trans>
                </span>
                <span
                  data-testid="stake-position-risk-pill"
                  className="bg-surfaceAlt text-textSecondary w-fit rounded-full px-2 py-0.5 text-xs font-medium"
                >
                  <Trans>No position</Trans>
                </span>
                {/* Grayed meter: no proximity, no risk tint (UX 1194:21273). */}
                <LiquidationZoneIndicator proximityPercentage={undefined} riskLevel={undefined} />
              </div>

              <p data-testid="stake-position-closed-copy" className="text-textSecondary text-sm">
                <Trans>
                  Your position has been closed, SKY has been withdrawn, and the debt has been repaid. To
                  stake SKY or borrow USDS, you must reopen it.
                </Trans>
              </p>

              <div className="border-textSecondary/10 grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-4 sm:grid-cols-3">
                <StatCell label={<Trans>Borrow rate</Trans>}>
                  {detail.stabilityFee !== undefined ? formatPercent(detail.stabilityFee) : NO_VALUE}
                </StatCell>
                <StatCell label={<Trans>Liquidation price</Trans>}>{NO_VALUE}</StatCell>
                <StatCell label={<Trans>Protocol SKY Price</Trans>}>
                  {vault?.delayedPrice !== undefined ? `$${formatBigInt(vault.delayedPrice)}` : NO_VALUE}
                </StatCell>
              </div>
            </>
          )}

          {hasDebt && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-textSecondary text-sm">
                  <Trans>Borrowed amount</Trans>
                </span>
                <span className="text-text flex items-baseline gap-2 text-4xl font-medium tracking-tight">
                  <TokenIcon
                    token={{ symbol: 'USDS' }}
                    width={32}
                    className="h-8 w-8 self-center"
                    showChainIcon={false}
                  />
                  {formatStakeAmount(vault?.debtValue ?? 0n)}
                  <span className="text-textSecondary text-sm font-normal">
                    {`(${formatUsd(detail.borrowedUsd)})`}
                  </span>
                </span>
              </div>

              <LiquidationZoneIndicator
                proximityPercentage={vault?.liquidationProximityPercentage}
                riskLevel={vault?.riskLevel}
              />

              <p data-testid="stake-position-warning" className="text-textSecondary text-sm">
                <Trans>
                  If the price of the collateral will go down{' '}
                  <span className="text-text font-medium">
                    {dropPercent !== null ? `${dropPercent.toFixed(2)}%` : NO_VALUE} ({formattedLiqPrice})
                  </span>
                  , you&apos;ll get liquidated. If you want to reduce these risks, add collateral or repay
                  part of your loan.
                </Trans>
              </p>

              <div className="border-textSecondary/10 grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-4 sm:grid-cols-4">
                <StatCell label={<Trans>Borrow rate</Trans>}>
                  {detail.stabilityFee !== undefined ? formatPercent(detail.stabilityFee) : NO_VALUE}
                </StatCell>
                <StatCell label={<Trans>Liquidation risk</Trans>}>
                  {vault?.riskLevel ? (
                    <span
                      data-testid="stake-position-risk-pill"
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        RISK_PILL_COLOR[vault.riskLevel]
                      )}
                    >
                      {vault.riskLevel.toLowerCase()}
                    </span>
                  ) : (
                    NO_VALUE
                  )}
                </StatCell>
                <StatCell label={<Trans>Liquidation price</Trans>}>{formattedLiqPrice}</StatCell>
                <StatCell label={<Trans>Protocol SKY Price</Trans>}>
                  {vault?.delayedPrice !== undefined ? `$${formatBigInt(vault.delayedPrice)}` : NO_VALUE}
                </StatCell>
              </div>
            </>
          )}
        </div>

        {/* Right panel — contextual manage menu. Inactive urns reorder to the
            frame layouts (C16): staked-only 1194:20561 / borrowed 1194:21273,
            enabled rows first, everything else disabled, single Reopen CTA. */}
        <div className="bg-surfaceAlt/30 flex w-full flex-col justify-between gap-6 p-8 lg:w-[340px]">
          <div className="flex flex-col">
            <h3 className="text-text mb-2 text-lg font-medium">
              <Trans>Manage position</Trans>
            </h3>

            {isInactive ? (
              <>
                {!showInactiveBorrowBlock && (
                  <MenuRow
                    icon={<Gem className="h-4 w-4" />}
                    label={<Trans>Claim rewards</Trans>}
                    disabled={claimDisabled}
                    onClick={onClaim}
                    dataTestId="stake-manage-menu-claim"
                    chip={claimChip}
                  />
                )}
                {/* Change reward stays an undesigned stub even though the UX
                    frame draws it enabled (B-Q1/M4, flagged — C16). */}
                <MenuRow
                  icon={<RefreshCcw className="h-4 w-4" />}
                  label={<Trans>Change reward</Trans>}
                  disabled
                  dataTestId="stake-manage-menu-change-reward"
                />
                <MenuRow
                  icon={<UserRound className="h-4 w-4" />}
                  label={<Trans>Change delegate</Trans>}
                  onClick={() => onAction('delegate')}
                  dataTestId="stake-manage-menu-change-delegate"
                />
                {showInactiveBorrowBlock && (
                  <>
                    <MenuRow
                      icon={<Gem className="h-4 w-4" />}
                      label={<Trans>Claim rewards</Trans>}
                      disabled={claimDisabled}
                      onClick={onClaim}
                      dataTestId="stake-manage-menu-claim"
                      chip={claimChip}
                    />
                    <MenuRow
                      icon={<CreditCard className="h-4 w-4" />}
                      label={<Trans>Borrow more USDS</Trans>}
                      disabled
                      dataTestId="stake-manage-menu-borrow"
                    />
                    <MenuRow
                      icon={<HandCoins className="h-4 w-4" />}
                      label={<Trans>Repay debt</Trans>}
                      disabled
                      dataTestId="stake-manage-menu-repay"
                    />
                  </>
                )}
                <MenuRow
                  icon={<ArrowUpFromLine className="h-4 w-4" />}
                  label={<Trans>Withdraw SKY</Trans>}
                  disabled
                  dataTestId="stake-manage-menu-withdraw"
                />
                {showInactiveBorrowBlock && (
                  <MenuRow
                    icon={<XCircle className="h-4 w-4" />}
                    label={<Trans>Close position</Trans>}
                    disabled
                    dataTestId="stake-manage-menu-close-position"
                  />
                )}
              </>
            ) : (
              <>
                <MenuRow
                  icon={<Gem className="h-4 w-4" />}
                  label={<Trans>Claim rewards</Trans>}
                  disabled={claimDisabled}
                  onClick={onClaim}
                  dataTestId="stake-manage-menu-claim"
                  chip={claimChip}
                />
                {hasDebt && (
                  <MenuRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label={<Trans>Borrow more USDS</Trans>}
                    onClick={() => onAction('borrow')}
                    dataTestId="stake-manage-menu-borrow"
                  />
                )}
                {hasDebt && (
                  <MenuRow
                    icon={<HandCoins className="h-4 w-4" />}
                    label={<Trans>Repay debt</Trans>}
                    onClick={() => onAction('repay')}
                    dataTestId="stake-manage-menu-repay"
                  />
                )}
                <MenuRow
                  icon={<ArrowUpFromLine className="h-4 w-4" />}
                  label={<Trans>Withdraw SKY</Trans>}
                  onClick={() => onAction('withdraw')}
                  dataTestId="stake-manage-menu-withdraw"
                />
                {/* Undesigned flows (B-Q1) — disabled, flagged on APP-312 (M4). */}
                <MenuRow
                  icon={<RefreshCcw className="h-4 w-4" />}
                  label={<Trans>Change reward</Trans>}
                  disabled
                  dataTestId="stake-manage-menu-change-reward"
                />
                <MenuRow
                  icon={<UserRound className="h-4 w-4" />}
                  label={<Trans>Change delegate</Trans>}
                  onClick={() => onAction('delegate')}
                  dataTestId="stake-manage-menu-change-delegate"
                />
                {hasDebt && (
                  <MenuRow
                    icon={<XCircle className="h-4 w-4" />}
                    label={<Trans>Close position</Trans>}
                    disabled
                    dataTestId="stake-manage-menu-close-position"
                  />
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {isInactive ? (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => onReopen(detail.hasBorrowHistory)}
                data-testid="stake-manage-cta-reopen"
              >
                <Trans>Reopen position</Trans>
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => onAction('stake')}
                  data-testid="stake-manage-cta-stake"
                >
                  <Trans>Stake more SKY</Trans>
                </Button>
                {!hasDebt && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => onAction('borrow')}
                    data-testid="stake-manage-cta-borrow"
                  >
                    <Trans>Borrow USDS</Trans>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
