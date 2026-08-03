import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import {
  ArrowUpFromLine,
  BanknoteArrowDown,
  BanknoteArrowUp,
  ChevronRight,
  Coins,
  DoorClosed,
  ExternalLink,
  Gem,
  Info,
  UserRound,
  X
} from 'lucide-react';
import { BP, MD_MEDIA_QUERY, RiskLevel, useBreakpointIndex, ZERO_ADDRESS } from '@/hooks';
import { formatBigInt, formatUsd, formatPercent, formatDecimalPercentage, WAD_PRECISION } from '@/utils';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { TrendingUpGradient } from '@/modules/icons';
import { CustomAvatar } from '@/modules/ui/components/Avatar';
import { RiskScaleMeter } from '@/components/product/RiskMeter';
import { formatStakeAmount } from '../lib/formatStakeAmount';
import { liquidationDropPercent } from '../lib/positionDetail';
import { useStakePositionDetail } from '../hooks/useStakePositionDetail';

const NO_VALUE = '–';

/** 0.01 in wad — below this the claim chip keeps 4 decimals instead of "<0.01". */
const CLAIM_DUST_WAD = 10n ** 16n;

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

// Stat cell (comps 1036:214176 desktop / 1292:63278 phone — same recipe at
// every tier): Body 6 label over a Label 5 Circular value.
function StatCell({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 md:min-w-[auto] md:flex-none">
      <span className="text-textSecondary flex items-center gap-1 text-xs leading-[18px]">{label}</span>
      <span className="text-text font-circle flex items-center gap-1 text-sm leading-4 font-medium tracking-[-0.28px]">
        {children}
      </span>
    </div>
  );
}

// Pair scaffolding: at the phone tier the stat grids read as rows of two equal
// columns split by a hairline; `md:contents` dissolves the row so the cells
// land back in the desktop grid untouched. The desktop comp draws its own
// hairlines between columns, so the pair divider stays visible at md except
// where the pair seam doesn't match a desktop column seam (passed `md:hidden`),
// and `StatDesktopDivider` fills the desktop-only seams.
const StatPair = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-6 md:contents">{children}</div>
);
const StatPairDivider = ({ className }: { className?: string }) => (
  <span className={cn('bg-borderPrimary h-8 w-px shrink-0 md:self-center', className)} aria-hidden />
);
const StatDesktopDivider = () => (
  <span className="bg-borderPrimary hidden h-8 w-px shrink-0 self-center md:block" aria-hidden />
);

// Info glyphs the mobile comp adds next to two bottom-strip labels; purely
// decorative (StakeTakeoverBorrowCard precedent), absent from the desktop comp.
const StatInfoIcon = () => <Info className="h-3 w-3 md:hidden" aria-hidden />;

function MenuRow({
  icon,
  label,
  chip,
  disabled = false,
  onClick,
  dataTestId,
  variant = 'panel'
}: {
  icon: ReactNode;
  label: ReactNode;
  chip?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  dataTestId: string;
  /** `panel` = desktop right-panel rows (bordered); `sheet` = mobile sheet rows (borderless 56px, comp 1222:16239). */
  variant?: 'panel' | 'sheet';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={dataTestId}
      className={cn(
        'group flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'panel' ? 'border-borderPrimary border-b py-8' : 'h-14'
      )}
    >
      <span className="text-text font-circle flex items-center gap-3 text-sm leading-4 font-medium tracking-[-0.28px]">
        <span className="text-textSecondary flex h-4 w-4 items-center justify-center" aria-hidden>
          {icon}
        </span>
        {label}
        {chip}
      </span>
      <ChevronRight className="text-fgQuaternary h-4 w-4" aria-hidden />
    </button>
  );
}

// The contextual menu rows, shared verbatim between the desktop right panel
// and the mobile manage sheet. Composition follows the debt state; an emptied
// urn reorders to the frame layouts (C16) with mostly-disabled rows. The
// undesigned `Change reward` / `Close position` flows render disabled —
// flagged on APP-312, not improvised.
function ManageMenuRows({
  loading,
  isInactive,
  hasDebt,
  showInactiveBorrowBlock,
  claimDisabled,
  claimChip,
  onAction,
  onClaim,
  variant = 'panel',
  idSuffix = ''
}: {
  loading: boolean;
  isInactive: boolean;
  hasDebt: boolean;
  showInactiveBorrowBlock: boolean;
  claimDisabled: boolean;
  claimChip?: ReactNode;
  onAction: (action: StakeManageAction) => void;
  onClaim: () => void;
  variant?: 'panel' | 'sheet';
  idSuffix?: string;
}) {
  if (loading) {
    // Active vs inactive is unknown until the vault resolves — a premature
    // active menu would offer the wrong flow for an emptied urn.
    return (
      <div className="flex flex-col gap-4 py-2" data-testid={`stake-manage-menu-loading${idSuffix}`}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  const rowProps = { variant };

  if (isInactive) {
    return (
      <>
        {!showInactiveBorrowBlock && (
          <MenuRow
            {...rowProps}
            icon={<Gem className="h-4 w-4" />}
            label={<Trans>Claim rewards</Trans>}
            disabled={claimDisabled}
            onClick={onClaim}
            dataTestId={`stake-manage-menu-claim${idSuffix}`}
            chip={claimChip}
          />
        )}
        {/* Change reward stays an undesigned stub even though the UX frame
            draws it enabled (B-Q1/M4, flagged — C16). */}
        <MenuRow
          {...rowProps}
          icon={<Coins className="h-4 w-4" />}
          label={<Trans>Change reward</Trans>}
          disabled
          dataTestId={`stake-manage-menu-change-reward${idSuffix}`}
        />
        <MenuRow
          {...rowProps}
          icon={<UserRound className="h-4 w-4" />}
          label={<Trans>Change delegate</Trans>}
          onClick={() => onAction('delegate')}
          dataTestId={`stake-manage-menu-change-delegate${idSuffix}`}
        />
        {showInactiveBorrowBlock && (
          <>
            <MenuRow
              {...rowProps}
              icon={<Gem className="h-4 w-4" />}
              label={<Trans>Claim rewards</Trans>}
              disabled={claimDisabled}
              onClick={onClaim}
              dataTestId={`stake-manage-menu-claim${idSuffix}`}
              chip={claimChip}
            />
            <MenuRow
              {...rowProps}
              icon={<BanknoteArrowDown className="h-4 w-4" />}
              label={<Trans>Borrow more USDS</Trans>}
              disabled
              dataTestId={`stake-manage-menu-borrow${idSuffix}`}
            />
            <MenuRow
              {...rowProps}
              icon={<BanknoteArrowUp className="h-4 w-4" />}
              label={<Trans>Repay debt</Trans>}
              disabled
              dataTestId={`stake-manage-menu-repay${idSuffix}`}
            />
          </>
        )}
        <MenuRow
          {...rowProps}
          icon={<ArrowUpFromLine className="h-4 w-4" />}
          label={<Trans>Withdraw SKY</Trans>}
          disabled
          dataTestId={`stake-manage-menu-withdraw${idSuffix}`}
        />
        {showInactiveBorrowBlock && (
          <MenuRow
            {...rowProps}
            icon={<DoorClosed className="h-4 w-4" />}
            label={<Trans>Close position</Trans>}
            disabled
            dataTestId={`stake-manage-menu-close-position${idSuffix}`}
          />
        )}
      </>
    );
  }

  return (
    <>
      <MenuRow
        {...rowProps}
        icon={<Gem className="h-4 w-4" />}
        label={<Trans>Claim rewards</Trans>}
        disabled={claimDisabled}
        onClick={onClaim}
        dataTestId={`stake-manage-menu-claim${idSuffix}`}
        chip={claimChip}
      />
      {hasDebt && (
        <MenuRow
          {...rowProps}
          icon={<BanknoteArrowDown className="h-4 w-4" />}
          label={<Trans>Borrow more USDS</Trans>}
          onClick={() => onAction('borrow')}
          dataTestId={`stake-manage-menu-borrow${idSuffix}`}
        />
      )}
      {hasDebt && (
        <MenuRow
          {...rowProps}
          icon={<BanknoteArrowUp className="h-4 w-4" />}
          label={<Trans>Repay debt</Trans>}
          onClick={() => onAction('repay')}
          dataTestId={`stake-manage-menu-repay${idSuffix}`}
        />
      )}
      <MenuRow
        {...rowProps}
        icon={<ArrowUpFromLine className="h-4 w-4" />}
        label={<Trans>Withdraw SKY</Trans>}
        onClick={() => onAction('withdraw')}
        dataTestId={`stake-manage-menu-withdraw${idSuffix}`}
      />
      {/* Undesigned flows (B-Q1) — disabled, flagged on APP-312 (M4). */}
      <MenuRow
        {...rowProps}
        icon={<Coins className="h-4 w-4" />}
        label={<Trans>Change reward</Trans>}
        disabled
        dataTestId={`stake-manage-menu-change-reward${idSuffix}`}
      />
      <MenuRow
        {...rowProps}
        icon={<UserRound className="h-4 w-4" />}
        label={<Trans>Change delegate</Trans>}
        onClick={() => onAction('delegate')}
        dataTestId={`stake-manage-menu-change-delegate${idSuffix}`}
      />
      {hasDebt && (
        <MenuRow
          {...rowProps}
          icon={<DoorClosed className="h-4 w-4" />}
          label={<Trans>Close position</Trans>}
          disabled
          dataTestId={`stake-manage-menu-close-position${idSuffix}`}
        />
      )}
    </>
  );
}

// The menu's primary CTAs, shared between the desktop panel (side-by-side,
// comp 1036:214314) and the mobile manage sheet (stacked, comp 1222:16239).
function ManageCtas({
  loading,
  isInactive,
  hasDebt,
  hasBorrowHistory,
  onAction,
  onReopen,
  size = 'xl',
  idSuffix = ''
}: {
  loading: boolean;
  isInactive: boolean;
  hasDebt: boolean;
  hasBorrowHistory: boolean;
  onAction: (action: StakeManageAction) => void;
  onReopen: (borrowExpanded: boolean) => void;
  size?: 'xl' | 'l';
  idSuffix?: string;
}) {
  if (loading) return <Skeleton className="h-12 w-full rounded-full" />;
  if (isInactive) {
    return (
      <Button
        variant="primary"
        size={size}
        className="w-full"
        onClick={() => onReopen(hasBorrowHistory)}
        data-testid={`stake-manage-cta-reopen${idSuffix}`}
      >
        <Trans>Reopen position</Trans>
      </Button>
    );
  }
  return (
    <>
      <Button
        variant="primary"
        size={size}
        className="w-full"
        onClick={() => onAction('stake')}
        data-testid={`stake-manage-cta-stake${idSuffix}`}
      >
        <Trans>Stake more SKY</Trans>
      </Button>
      {!hasDebt && (
        <Button
          variant="secondary"
          size={size}
          className="w-full"
          onClick={() => onAction('borrow')}
          data-testid={`stake-manage-cta-borrow${idSuffix}`}
        >
          <Trans>Borrow USDS</Trans>
        </Button>
      )}
    </>
  );
}

/**
 * Position-details modal (redesign comps 1036:214176 debt / 1036:214314 no
 * debt; flows from F5 hi-fi 486:32508 / UX 1050:20860 + 1050:21185, F6
 * inactive variants 1194:20561 + 1194:21273): two panels — left is the
 * read-only position detail (heroes, stat grid, liquidation-zone indicator +
 * warning, bottom stat strip), right is the contextual "Manage position" menu
 * on the darker subsection panel.
 *
 * Phone tier (comps 1292:63278 details / 1222:15571 viewport / 1222:16239
 * sheet): the card fills the viewport minus a 12px inset, the menu panel is
 * hidden, and a pinned "Stake more SKY / Manage position" footer floats over
 * the scrolling detail; "Manage position" raises the menu as a bottom sheet
 * that reuses the panel's row/CTA composition. Desktop is untouched.
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

  // Mobile-only manage sheet (the footer's "Manage position" trigger is
  // md:hidden, so this can only ever open at the phone tier). The ref mirror
  // is written from event handlers only (react-hooks/refs) — the Escape guard
  // below reads it because Radix invokes that handler from a stale closure.
  const [manageOpen, setManageOpen] = useState(false);
  const manageOpenRef = useRef(false);
  const setManageSheet = useCallback((open: boolean) => {
    manageOpenRef.current = open;
    setManageOpen(open);
  }, []);

  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  // Crossing to ≥md with the sheet open (rotation, window resize) would strand
  // its overlay: the sheet content is md:hidden, but the shared DialogContent
  // wrapper's full-screen overlay — and Radix's scroll lock + focus trap — is
  // not, leaving the page dimmed with nothing clickable. Close it instead,
  // from a listener on the same query the JS breakpoint scale tracks (an
  // event callback, so the ref write and setState stay off the render path).
  useEffect(() => {
    const mdQuery = window.matchMedia(MD_MEDIA_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setManageSheet(false);
    };
    mdQuery.addEventListener('change', closeOnDesktop);
    return () => mdQuery.removeEventListener('change', closeOnDesktop);
  }, [setManageSheet]);

  const dropPercent = liquidationDropPercent(vault?.liquidationProximityPercentage);
  // Price fields pin 4 decimals like the takeover/manage cards — the bare
  // magnitude-driven default would drop to 2 the moment a price crosses $10.
  const formattedLiqPrice =
    vault?.liquidationPrice !== undefined
      ? `$${formatBigInt(vault.liquidationPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
      : NO_VALUE;
  const hasDelegate = !!detail.voteDelegate && detail.voteDelegate !== ZERO_ADDRESS;

  const claimDisabled = detail.claimableLoading || detail.claimableTokenAmount === 0n;
  const claimChip =
    detail.claimableTokenAmount > 0n ? (
      // Badges/Special (comp 1036:214176): gradient pill, amount + 12px token
      // icon, no symbol text. Gradient hexes are raw in Figma (no variable).
      // Compact keeps the pill bounded on huge balances (123.46M, not
      // 123,456,789); maxDecimals caps the sub-10 four-decimal default —
      // except under 0.01, where the cap would collapse every dust claimable
      // to "<0.01"; those keep the 4 decimals so a real 0.0012 stays legible.
      <span className="text-text font-circle flex h-5 items-center gap-1 rounded-full bg-gradient-to-r from-[#46CCFC]/20 to-[#EB65CB]/20 px-1.5 text-xs leading-[14px] font-medium tracking-[-0.24px]">
        {formatBigInt(detail.claimableTokenAmount, {
          compact: true,
          maxDecimals: detail.claimableTokenAmount < CLAIM_DUST_WAD ? 4 : 2
        })}
        <TokenIcon
          token={{ symbol: detail.claimableSymbols[0] }}
          width={12}
          className="h-3 w-3"
          showChainIcon={false}
        />
      </span>
    ) : undefined;

  const menuRowsProps = {
    loading: detail.vaultLoading,
    isInactive,
    hasDebt,
    showInactiveBorrowBlock,
    claimDisabled,
    claimChip,
    onAction,
    onClaim
  };
  const ctaProps = {
    loading: detail.vaultLoading,
    isInactive,
    hasDebt,
    hasBorrowHistory: detail.hasBorrowHistory,
    onAction,
    onReopen
  };

  return (
    <>
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent
          aria-describedby={undefined}
          data-testid="stake-position-details"
          // sm:p-0 kills the shared DialogContent's sm:px-10/sm:py-8 — the
          // comp's subsection panel runs full-bleed to the card edges
          // (1036:214369: x=720 y=0 h=card), so the card itself carries no
          // padding at any tier; each column brings its own p-8.
          className="bg-containerDark md:bg-bgSecondary flex h-[calc(100dvh-24px)] max-h-none w-[calc(100vw-24px)] flex-col gap-0 overflow-y-auto rounded-[20px] p-0 sm:min-w-0 sm:p-0 md:h-auto md:max-h-[90vh] md:w-full md:rounded-[28px] lg:max-w-[1042px] lg:flex-row"
          onOpenAutoFocus={event => event.preventDefault()}
          // The manage sheet portals outside this content, so its pointer
          // interactions read as backdrop dismissals here (some only landing
          // AFTER the sheet has closed, via Radix's deferred dispatch) and
          // would take the details modal down with the sheet. At the phone
          // tier the card fills the viewport minus 12px gutters anyway, so
          // outside-pointer dismissal is dropped there wholesale; desktop
          // keeps its backdrop-click behavior.
          onInteractOutside={event => {
            if (isMobile) event.preventDefault();
          }}
          // With the sheet open, Escape belongs to the sheet — this handler
          // fires before the sheet's own (listener registration order), so
          // the ref is still set at that point.
          onEscapeKeyDown={event => {
            if (manageOpenRef.current) event.preventDefault();
          }}
        >
          {/* Left panel — read-only position detail */}
          {/* justify-between (md): when the menu panel drives the card height —
              the no-debt comp 1036:214314 — the spare height distributes over
              the block gaps (title top, hero mid, stats bottom); a full column
              (debt comp) sits at the 40px minimum rhythm unchanged. */}
          <div className="flex flex-1 flex-col gap-6 p-5 md:justify-between md:gap-10 md:p-8">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-text font-circle flex items-center gap-2 text-base leading-[18px] font-medium tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]">
                <Trans>Position {urnIndex + 1}</Trans>
                {isInactive && (
                  <span
                    data-testid="stake-position-inactive-chip"
                    className="bg-surfaceAlt text-textSecondary font-circle rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    <Trans>Inactive</Trans>
                  </span>
                )}
              </DialogTitle>
              <Button
                variant="secondary"
                size="iconM"
                onClick={onClose}
                aria-label={t`Close`}
                data-testid="stake-position-details-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-2 flex flex-col gap-2 md:mt-0">
              <span className="text-textSecondary text-xs leading-[18px]">
                <Trans>Staked amount</Trans>
              </span>
              <span className="text-text font-circle flex items-baseline gap-3 text-[32px] leading-[35px] font-medium tracking-[-0.64px] md:text-[44px] md:leading-[48px] md:tracking-[-0.88px]">
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
                <span className="text-textSecondary text-xs leading-[18px] font-normal tracking-normal md:-ml-1">
                  {detail.stakedUsd !== null ? `(~${formatUsd(detail.stakedUsd)})` : ''}
                </span>
              </span>
            </div>

            {/* 2×3 desktop grid with vertical hairline seams between columns
                (comp 1036:214176: 120px, 120px, then the hugging rest). The
                five tracks read cell│seam│cell│seam│cell and are filled purely
                by source order once md:contents dissolves the pairs, so each
                md row must receive exactly five in-flow items — three cells on
                the 120px/120px/1fr tracks and a divider on each 1px seam:
                  row 1: rewards rate │ reward token │ delegating-to
                  row 2: claimable    │ est. annual  │ rewards earned
                Pair 2's own divider is md:hidden because its seam falls on the
                row break; adding a cell or dropping a divider without
                rebalancing this rhythm shifts every later cell one track over. */}
            <div className="flex flex-col gap-4 md:grid md:grid-cols-[120px_1px_120px_1px_minmax(0,1fr)] md:gap-x-8 md:gap-y-6">
              <StatPair>
                <StatCell label={<Trans>Rewards rate</Trans>}>
                  {detail.rewardsRate !== null ? formatDecimalPercentage(detail.rewardsRate) : NO_VALUE}
                </StatCell>
                <StatPairDivider />
                <StatCell label={<Trans>Reward token</Trans>}>
                  {detail.rewardSymbol ? (
                    <>
                      <TokenIcon
                        token={{ symbol: detail.rewardSymbol }}
                        width={12}
                        className="h-3 w-3"
                        showChainIcon={false}
                      />
                      {detail.rewardSymbol}
                    </>
                  ) : (
                    NO_VALUE
                  )}
                </StatCell>
                <StatDesktopDivider />
              </StatPair>
              <StatPair>
                <StatCell label={<Trans>Delegating to</Trans>}>
                  {hasDelegate ? (
                    <a
                      href={`https://vote.sky.money/address/${detail.voteDelegate!.toLowerCase()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="stake-position-delegate-link"
                      className="hover:text-text flex items-center gap-1"
                    >
                      <span className="flex" aria-hidden>
                        <CustomAvatar address={detail.voteDelegate!.toLowerCase()} size={12} />
                      </span>
                      {shortenAddress(detail.voteDelegate!)}
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : (
                    NO_VALUE
                  )}
                </StatCell>
                <StatPairDivider className="md:hidden" />
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
                          width={12}
                          className="h-3 w-3"
                          showChainIcon={false}
                        />
                      ))}
                    </>
                  )}
                </StatCell>
                <StatDesktopDivider />
              </StatPair>
              <StatPair>
                <StatCell label={<Trans>Est. annual rewards</Trans>}>
                  {isInactive ? (
                    // Nothing staked accrues nothing — the frame shows a flat $0.00.
                    formatUsd(0)
                  ) : detail.estAnnualRewardsSky !== null && detail.skyPriceUsd !== null ? (
                    <span className="flex items-center gap-1">
                      <TrendingUpGradient boxSize={12} className="h-3 w-3 shrink-0" aria-hidden />
                      {formatUsd(
                        (Number(detail.estAnnualRewardsSky / 10n ** 12n) / 1e6) * detail.skyPriceUsd
                      )}
                      {detail.rewardSymbol && (
                        <TokenIcon
                          token={{ symbol: detail.rewardSymbol }}
                          width={12}
                          className="h-3 w-3"
                          showChainIcon={false}
                        />
                      )}
                    </span>
                  ) : (
                    NO_VALUE
                  )}
                </StatCell>
                <StatPairDivider />
                <StatCell label={<Trans>Rewards earned</Trans>}>
                  {detail.rewardsEarnedLoading ? (
                    // A still-loading history leg reads as $0.00 otherwise — hold
                    // the figure like the claimable cell above does.
                    <Skeleton className="h-4 w-14" />
                  ) : (
                    <span className="flex items-center gap-1">
                      <TrendingUpGradient boxSize={12} className="h-3 w-3 shrink-0" aria-hidden />
                      {formatUsd(detail.rewardsEarnedUsd)}
                      {detail.rewardSymbol && (
                        <TokenIcon
                          token={{ symbol: detail.rewardSymbol }}
                          width={12}
                          className="h-3 w-3"
                          showChainIcon={false}
                        />
                      )}
                    </span>
                  )}
                </StatCell>
              </StatPair>
            </div>

            {showInactiveBorrowBlock && (
              <>
                <div className="bg-borderPrimary my-2 h-px w-full md:my-0" aria-hidden />
                <div className="flex flex-col gap-2">
                  <span className="text-textSecondary text-xs leading-[18px]">
                    <Trans>Borrowed amount</Trans>
                  </span>
                  <span className="text-text font-circle flex items-baseline gap-3 text-[32px] leading-[35px] font-medium tracking-[-0.64px] md:text-[44px] md:leading-[48px] md:tracking-[-0.88px]">
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
                  <span className="text-textSecondary text-xs leading-[18px]">
                    <Trans>Liquidation risk</Trans>
                  </span>
                  <span
                    data-testid="stake-position-risk-pill"
                    className="bg-surfaceAlt text-textSecondary font-circle w-fit rounded-full px-2 py-0.5 text-xs font-medium"
                  >
                    <Trans>No position</Trans>
                  </span>
                  {/* Grayed meter: no proximity, no risk tint (UX 1194:21273). */}
                  <div data-testid="stake-position-risk-indicator">
                    <RiskScaleMeter />
                  </div>
                </div>

                <p
                  data-testid="stake-position-closed-copy"
                  className="text-textSecondary text-xs leading-[18px]"
                >
                  <Trans>
                    Your position has been closed, SKY has been withdrawn, and the debt has been repaid. To
                    stake SKY or borrow USDS, you must reopen it.
                  </Trans>
                </p>

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-10">
                  <StatPair>
                    <StatCell label={<Trans>Borrow rate</Trans>}>
                      {detail.stabilityFee !== undefined ? formatPercent(detail.stabilityFee) : NO_VALUE}
                    </StatCell>
                    <StatPairDivider />
                    <StatCell label={<Trans>Liquidation price</Trans>}>{NO_VALUE}</StatCell>
                    <StatDesktopDivider />
                  </StatPair>
                  <StatPair>
                    <StatCell
                      label={
                        <>
                          <Trans>Protocol SKY Price</Trans>
                          <StatInfoIcon />
                        </>
                      }
                    >
                      {vault?.delayedPrice !== undefined
                        ? `$${formatBigInt(vault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
                        : NO_VALUE}
                    </StatCell>
                  </StatPair>
                </div>
              </>
            )}

            {hasDebt && (
              <>
                <div className="bg-borderPrimary my-2 h-px w-full md:my-0" aria-hidden />
                <div className="flex flex-col gap-2">
                  <span className="text-textSecondary text-xs leading-[18px]">
                    <Trans>Borrowed amount</Trans>
                  </span>
                  <span className="text-text font-circle flex items-baseline gap-3 text-[32px] leading-[35px] font-medium tracking-[-0.64px] md:text-[44px] md:leading-[48px] md:tracking-[-0.88px]">
                    <TokenIcon
                      token={{ symbol: 'USDS' }}
                      width={32}
                      className="h-8 w-8 self-center"
                      showChainIcon={false}
                    />
                    {formatStakeAmount(vault?.debtValue ?? 0n)}
                    <span className="text-textSecondary text-xs leading-[18px] font-normal tracking-normal md:-ml-1">
                      {`(${formatUsd(detail.borrowedUsd)})`}
                    </span>
                  </span>
                </div>

                {/* Meter + warning read as one block: 20px apart at md (comp
                    1036:214176), tighter than the 40px section rhythm. */}
                <div className="flex flex-col gap-6 md:gap-5">
                  {/* Real proximity fills the bar; the vault's risk level tints it
                      (thresholds 0/25/40/80 aren't the bar's even quarters). */}
                  <div data-testid="stake-position-risk-indicator">
                    <RiskScaleMeter
                      value={(vault?.liquidationProximityPercentage ?? 0) / 100}
                      level={vault?.riskLevel}
                    />
                  </div>

                  <p
                    data-testid="stake-position-warning"
                    className="text-textSecondary text-xs leading-[18px]"
                  >
                    <Trans>
                      If the price of the collateral will go down{' '}
                      <span className="text-text font-circle font-medium">
                        {dropPercent !== null ? `${dropPercent}%` : NO_VALUE} ({formattedLiqPrice})
                      </span>
                      , you&apos;ll get liquidated. If you want to reduce these risks, add collateral or repay
                      part of your loan.
                    </Trans>
                  </p>
                </div>

                {/* Bottom strip: hugging cells split by hairlines, no top border
                    (comp 1036:214176). */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-10">
                  <StatPair>
                    <StatCell label={<Trans>Borrow rate</Trans>}>
                      {detail.stabilityFee !== undefined ? formatPercent(detail.stabilityFee) : NO_VALUE}
                    </StatCell>
                    <StatPairDivider />
                    <StatCell
                      label={
                        <>
                          <Trans>Liquidation risk</Trans>
                          <StatInfoIcon />
                        </>
                      }
                    >
                      {vault?.riskLevel ? (
                        <span
                          data-testid="stake-position-risk-pill"
                          className={cn(
                            'font-circle rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            RISK_PILL_COLOR[vault.riskLevel]
                          )}
                        >
                          {vault.riskLevel.toLowerCase()}
                        </span>
                      ) : (
                        NO_VALUE
                      )}
                    </StatCell>
                    <StatDesktopDivider />
                  </StatPair>
                  <StatPair>
                    <StatCell label={<Trans>Liquidation price</Trans>}>{formattedLiqPrice}</StatCell>
                    <StatPairDivider />
                    <StatCell
                      label={
                        <>
                          <Trans>Protocol SKY Price</Trans>
                          <StatInfoIcon />
                        </>
                      }
                    >
                      {vault?.delayedPrice !== undefined
                        ? `$${formatBigInt(vault.delayedPrice, { unit: WAD_PRECISION, maxDecimals: 4 })}`
                        : NO_VALUE}
                    </StatCell>
                  </StatPair>
                </div>
              </>
            )}
          </div>

          {/* Right panel — contextual manage menu (desktop only; the phone tier
              reaches the same rows through the manage sheet below). */}
          <div className="bg-modalSubsection hidden w-full flex-col justify-between gap-6 p-8 md:flex lg:w-[322px]">
            <div className="flex flex-col">
              <h3 className="text-text font-circle mb-8 text-lg leading-[22px] font-medium tracking-[-0.36px]">
                <Trans>Manage position</Trans>
              </h3>
              {/* 80px row pitch: py-8 rows with half-padding end caps and no
                  hairline after the last row (comp 1036:214176). */}
              <div className="flex flex-col [&>button:first-child]:pt-4 [&>button:last-child]:border-b-0 [&>button:last-child]:pb-4">
                <ManageMenuRows {...menuRowsProps} variant="panel" />
              </div>
            </div>

            {/* Side-by-side pair (comp 1036:214314) — equal columns, labels may
                ellipsize rather than overflow the 322px panel. */}
            <div className="flex gap-2 [&>button]:min-w-0 [&>button]:flex-1">
              <ManageCtas {...ctaProps} size="l" />
            </div>
          </div>

          {/* Phone tier: pinned CTA pair floating over the scrolling detail
              (comp 1222:15571) — content fades out under the gradient. */}
          <div className="from-containerDark sticky bottom-0 z-10 mt-auto flex shrink-0 gap-2 bg-linear-to-t from-65% to-transparent px-5 pt-10 pb-5 md:hidden">
            {detail.vaultLoading ? (
              <Skeleton className="h-12 min-w-0 flex-1 rounded-full" />
            ) : isInactive ? (
              <Button
                variant="primary"
                size="l"
                className="min-w-0 flex-1"
                onClick={() => onReopen(detail.hasBorrowHistory)}
                data-testid="stake-details-cta-reopen"
              >
                <Trans>Reopen position</Trans>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="l"
                className="min-w-0 flex-1"
                onClick={() => onAction('stake')}
                data-testid="stake-details-cta-stake"
              >
                <Trans>Stake more SKY</Trans>
              </Button>
            )}
            <Button
              variant="secondary"
              size="l"
              className="min-w-0 flex-1"
              onClick={() => setManageSheet(true)}
              data-testid="stake-details-cta-manage"
            >
              <Trans>Manage position</Trans>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile manage sheet (comp 1222:16239): a floating bottom card over
          the dimmed details modal reusing the panel's row/CTA composition;
          × returns to the details view underneath. The Dialog stays mounted
          with a controlled `open` so Radix holds the content through the
          slide-out exit animation instead of unmounting it instantly. */}
      <Dialog open={manageOpen} onOpenChange={open => !open && setManageSheet(false)}>
        <DialogContent
          aria-describedby={undefined}
          data-testid="stake-manage-sheet"
          onOpenAutoFocus={event => event.preventDefault()}
          className="bg-containerDark data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 top-auto right-3 bottom-3 left-3 flex w-auto max-w-none min-w-0 translate-x-0 translate-y-0 flex-col gap-0 rounded-[20px] p-5 sm:min-w-0 sm:px-5 sm:py-5 md:hidden"
        >
          <div className="flex items-center justify-between">
            <DialogTitle className="text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
              <Trans>Manage position</Trans>
            </DialogTitle>
            <Button
              variant="secondary"
              size="iconM"
              onClick={() => setManageSheet(false)}
              aria-label={t`Close`}
              data-testid="stake-manage-sheet-close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 flex flex-col">
            <ManageMenuRows {...menuRowsProps} variant="sheet" idSuffix="-sheet" />
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <ManageCtas {...ctaProps} size="l" idSuffix="-sheet" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
