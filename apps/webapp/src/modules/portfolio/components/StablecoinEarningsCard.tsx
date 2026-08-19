import { Children, Fragment, ReactNode, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import { formatDecimalPercentage, formatUsd, projectAnnualEarnings } from '@/utils';
import { Card } from '@/components/ui/card';
import { GainValue } from '@/components/ui/GainValue';
import { Skeleton } from '@/components/ui/skeleton';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';
import type { EarningsFigure, Maybe, WalletEarnings } from '../earnings/types';
import { earningsForPosition } from '../earnings/earningsForPosition';
import { PortfolioDonutChart, type DonutSegment } from './PortfolioDonutChart';
import { PortfolioTabs, type PortfolioTab } from './PortfolioTabs';
import { CombinedEarningsStat, EarningsFigureValue } from './EarningsStat';

/**
 * M6.1 (486:20132): the mobile comp stacks the chart block headline → donut →
 * legend, while the desktop comp pairs a headline+legend column with the donut
 * beside it. Below md the column dissolves into the parent flow so all three
 * blocks order themselves against it; from md it re-forms and DOM order wins,
 * restoring the pre-M6.1 layout untouched at every tier md and up.
 *
 * The seam is md (768 = BP.md), matching `useDonutSize` — a mismatch would give
 * 768–911 a hybrid (reordered blocks around the desktop 178 donut) matching neither
 * comp. Callers add their own `md:gap-*` since the skeleton and the loaded card
 * space their columns differently.
 *
 * Caveat: below md this makes DOM order (headline → legend → donut) diverge from
 * visual order. Harmless today — LegendRow and the recharts sectors are
 * hover-driven, not focusable — but giving either a keyboard affordance would
 * create a tab-order trap, and this is the constraint to revisit first.
 */
const COLUMN = 'contents md:flex md:flex-col';
const DONUT = 'order-2 md:order-none';
const LEGEND = 'order-3 md:order-none';

/** Donut box: 160 on phones per the comp (486:20138), the desktop 178 from md
 * per the Portfolio card comp (5034:39333 / 1036:189543). */
function useDonutSize() {
  const { bpi } = useBreakpointIndex();
  return bpi < BP.md ? 160 : 178;
}

export function StablecoinEarningsCard({
  suppliedView,
  suppliedLoading,
  idleView,
  idleLoading,
  savingsRate,
  earnings,
  tab,
  onTabChange
}: {
  suppliedView: SuppliedView;
  suppliedLoading: boolean;
  idleView: IdleView;
  idleLoading: boolean;
  /** Current Sky Savings Rate as a decimal fraction (0.0375 = 3.75%), or
   * undefined when Savings is geo-restricted — the Idle footer then drops the
   * rate and projection stats instead of pitching a blocked product. */
  savingsRate?: number;
  /** APP-450 wallet earnings driving the Total earned / Earned this month stats. */
  earnings: WalletEarnings;
  tab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}) {
  return (
    <Card className="p-6 md:p-8" data-testid="stablecoin-earnings-card">
      <PortfolioTabs tab={tab} onTabChange={onTabChange} />

      {tab === 'idle' ? (
        <IdleContent view={idleView} savingsRate={savingsRate} isLoading={idleLoading} />
      ) : (
        <SuppliedContent view={suppliedView} earnings={earnings} isLoading={suppliedLoading} />
      )}
    </Card>
  );
}

function SuppliedContent({
  view,
  earnings,
  isLoading
}: {
  view: SuppliedView;
  earnings: WalletEarnings;
  isLoading: boolean;
}) {
  // Hovering a position (legend or chart) focuses the card on it: totals and
  // footer stats collapse to that single position's values.
  const [activeId, setActiveId] = useState<string | null>(null);
  const donutSize = useDonutSize();

  if (isLoading && view.positions.length === 0) return <EarningsSkeleton />;

  const activePosition = activeId ? view.positions.find(p => p.id === activeId) : undefined;
  // Hover-focus for the two earnings stats: the hovered position's own slice
  // (null when the row is outside APP-450 scope → dash, like its siblings).
  const activeEarnings = activePosition ? earningsForPosition(earnings, activePosition.id) : null;
  const activeSymbol = activePosition?.tokenSymbol ?? null;
  const displayTotal = activePosition ? activePosition.amountUsd : view.totalSupplied;
  const displayProjected = activePosition
    ? projectAnnualEarnings(activePosition.amountUsd, activePosition.rate)
    : view.projected1Y;
  const displayAvgRate = activePosition ? (activePosition.rate ?? 0) : view.avgRate;

  const segments: DonutSegment[] = view.positions.map(p => ({
    id: p.id,
    color: p.color,
    hoverColor: p.hoverColor,
    value: p.amountUsd
  }));

  return (
    <>
      {/* The comp (5034:39333) insets the chart 80px from the card's right
          edge (`pr-[80px]` on the row) so the donut doesn't hug the border. */}
      <div className="mt-6 flex flex-col gap-10 md:gap-8 lg:flex-row lg:items-start lg:justify-between lg:pr-20">
        <div className={cn(COLUMN, 'md:gap-8')}>
          <EarningsHeadline
            label={<Trans>Total supplied</Trans>}
            value={displayTotal}
            tokenSymbols={view.suppliedTokens}
            activeSymbol={activeSymbol}
          />

          <ul className={cn(LEGEND, 'flex flex-col gap-3')} onMouseLeave={() => setActiveId(null)}>
            {view.positions.map(position => {
              const pct = position.share * 100;
              const pctLabel = pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
              return (
                <li key={position.id}>
                  <LegendRow
                    color={position.color}
                    dimmed={!!activeId && activeId !== position.id}
                    onActivate={() => setActiveId(position.id)}
                    onDeactivate={() => setActiveId(null)}
                  >
                    <Text variant="medium" tag="span" className="text-text font-circle font-medium">
                      {position.name}
                    </Text>
                    <Text variant="medium" tag="span" className="text-textSecondary">
                      ({pctLabel})
                    </Text>
                  </LegendRow>
                </li>
              );
            })}
            {/* `ul` only admits `li` children, so the empty state gets one too. */}
            {view.positions.length === 0 && (
              <li>
                <Text variant="medium" className="text-textSecondary">
                  <Trans>No supplied positions yet.</Trans>
                </Text>
              </li>
            )}
          </ul>
        </div>

        <PortfolioDonutChart
          segments={segments}
          activeId={activeId}
          onActiveChange={setActiveId}
          size={donutSize}
          renderCenter={id => {
            const position = view.positions.find(p => p.id === id);
            return position ? <DonutCenter symbol={position.tokenSymbol} /> : null;
          }}
          className={cn(DONUT, 'mx-auto shrink-0 lg:mx-0')}
        />
      </div>

      <Divider />

      <FooterStats>
        <Stat
          label={<Trans>Total earned</Trans>}
          value={
            activePosition ? (
              <EarningsFigureValue
                figure={activeEarnings?.totalEarned ?? null}
                variant="gain"
                className={figureClass(activeEarnings?.totalEarned)}
                testId="earnings-total-value"
              />
            ) : (
              <CombinedEarningsStat
                earnings={earnings}
                field="total"
                className={LABEL_4}
                testId="earnings-total-value"
              />
            )
          }
        />
        <Stat
          label={<Trans>Earned this month</Trans>}
          value={
            activePosition ? (
              <EarningsFigureValue
                figure={activeEarnings?.earnedThisMonth ?? null}
                variant="gain"
                className={figureClass(activeEarnings?.earnedThisMonth)}
                testId="earnings-month-value"
              />
            ) : (
              <CombinedEarningsStat
                earnings={earnings}
                field="month"
                className={LABEL_4}
                testId="earnings-month-value"
              />
            )
          }
        />
        <Stat
          label={<Trans>1Y projected earnings</Trans>}
          value={<GainValue value={displayProjected} className={LABEL_4} />}
        />
        <Stat
          label={<Trans>Avg. Rate</Trans>}
          value={<StatValue>{formatDecimalPercentage(displayAvgRate)}</StatValue>}
        />
        <Stat label={<Trans>Active positions</Trans>} value={<StatValue>{view.activePositions}</StatValue>} />
      </FooterStats>
    </>
  );
}

function IdleContent({
  view,
  savingsRate,
  isLoading
}: {
  view: IdleView;
  savingsRate?: number;
  isLoading: boolean;
}) {
  // Hovering a token focuses the card on it (mirrors the Supplied tab).
  const [activeId, setActiveId] = useState<string | null>(null);
  const donutSize = useDonutSize();

  if (isLoading && view.tokens.length === 0) return <EarningsSkeleton />;

  const activeToken = activeId ? view.tokens.find(t => t.symbol === activeId) : undefined;
  const activeSymbol = activeToken?.symbol ?? null;
  const displayTotal = activeToken ? activeToken.amountUsd : view.walletBalance;
  const displayProjected =
    savingsRate !== undefined ? projectAnnualEarnings(displayTotal, savingsRate) : undefined;

  const segments: DonutSegment[] = view.tokens.map(t => ({
    id: t.symbol,
    color: t.color,
    hoverColor: t.hoverColor,
    value: t.amountUsd
  }));

  return (
    <>
      {/* Same 80px right inset for the chart as the Supplied tab (5034:39333). */}
      <div className="mt-6 flex flex-col gap-10 md:gap-8 lg:flex-row lg:items-start lg:justify-between lg:pr-20">
        <div className={cn(COLUMN, 'md:gap-8')}>
          <EarningsHeadline
            label={<Trans>Wallet balance</Trans>}
            value={displayTotal}
            tokenSymbols={view.tokens.map(t => t.symbol)}
            activeSymbol={activeSymbol}
          />

          <ul className={cn(LEGEND, 'flex flex-col gap-3')} onMouseLeave={() => setActiveId(null)}>
            {view.tokens.map(token => (
              <li key={token.symbol}>
                <LegendRow
                  color={token.color}
                  dimmed={!!activeId && activeId !== token.symbol}
                  onActivate={() => setActiveId(token.symbol)}
                  onDeactivate={() => setActiveId(null)}
                >
                  <Text variant="medium" tag="span" className="text-text font-circle font-medium">
                    {token.symbol}
                  </Text>
                  <Text variant="medium" tag="span" className="text-textSecondary">
                    ({token.name})
                  </Text>
                </LegendRow>
              </li>
            ))}
            {/* `ul` only admits `li` children, so the empty state gets one too. */}
            {view.tokens.length === 0 && (
              <li>
                <Text variant="medium" className="text-textSecondary">
                  <Trans>No idle stablecoins.</Trans>
                </Text>
              </li>
            )}
          </ul>
        </div>

        <PortfolioDonutChart
          segments={segments}
          activeId={activeId}
          onActiveChange={setActiveId}
          size={donutSize}
          renderCenter={id => <DonutCenter symbol={id} />}
          className={cn(DONUT, 'mx-auto shrink-0 lg:mx-0')}
        />
      </div>

      <Divider />

      <FooterStats>
        {savingsRate !== undefined && (
          <Stat
            label={<Trans>Sky Savings Rate</Trans>}
            value={<StatValue>{formatDecimalPercentage(savingsRate)}</StatValue>}
          />
        )}
        {displayProjected !== undefined && (
          <Stat
            label={<Trans>1Y projected earnings</Trans>}
            value={<GainValue value={displayProjected} className={LABEL_4} />}
          />
        )}
        <Stat label={<Trans>Idle stablecoins</Trans>} value={<StatValue>{view.idleCount}</StatValue>} />
      </FooterStats>
    </>
  );
}

/** Total label + value with the overlapping token-icon cluster (dims on hover). */
function EarningsHeadline({
  label,
  value,
  tokenSymbols,
  activeSymbol
}: {
  label: ReactNode;
  value: number;
  tokenSymbols: string[];
  activeSymbol: string | null;
}) {
  const { bpi } = useBreakpointIndex();
  // Badge cluster: 24 on phones per the comp (486:20137), the desktop 28 from md.
  const iconSize = bpi < BP.md ? 24 : 28;

  return (
    <div className="flex flex-col gap-2">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      <div className="flex items-center gap-3">
        {/* 32/35 on phones per the comp (486:20136), the desktop 40 from md. */}
        <Heading
          tag="h2"
          className="text-text font-circle text-[32px] leading-[35px] md:text-[40px] md:leading-none"
        >
          {formatUsd(value)}
        </Heading>
        <IconStack size={iconSize}>
          {tokenSymbols.map(symbol => (
            <TokenIcon
              key={symbol}
              token={{ symbol }}
              width={iconSize}
              showChainIcon={false}
              className={cn(
                'h-full w-full transition-opacity',
                activeSymbol && activeSymbol !== symbol && 'opacity-50'
              )}
            />
          ))}
        </IconStack>
      </div>
    </div>
  );
}

/** A hoverable legend entry: colored swatch + caller-provided label content. */
function LegendRow({
  color,
  dimmed,
  onActivate,
  onDeactivate,
  children
}: {
  color: string;
  dimmed: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn('flex items-center gap-3 text-left transition-opacity', dimmed && 'opacity-50')}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
    >
      <span className="h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </button>
  );
}

/** The active segment's token, shown centered in the donut hole: 16px icon +
 * Label 4 (Circular 16/18, -0.32 tracking) per the comp (1036:189543). */
function DonutCenter({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <span className="text-text font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
        {symbol}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-borderPrimary mt-8 mb-6 border-b" />;
}

/**
 * The card's footer figures. From lg the comp (1030:58701) lays them out as
 * one row of equal columns split by 28px hairlines, 32px clear on each side —
 * so that tier is a flex row and the dividers come along; below it the stats
 * keep wrapping in the grid and the dividers drop out entirely (`display:none`
 * takes them out of grid flow, so they never claim a cell).
 */
function FooterStats({ children }: { children: ReactNode }) {
  const stats = Children.toArray(children);
  return (
    <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:flex lg:gap-8">
      {stats.map((stat, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="bg-borderPrimary hidden h-7 w-px shrink-0 self-center lg:block" />}
          {stat}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Design-system Label 4 — Circular Medium 16/18, -0.32px — the comp's treatment
 * for every footer stat value. Same recipe as `label4` in ui/table-cells.
 * Previously `text-lg font-medium`, which was wrong three ways: Graphik instead
 * of Circular (no `font-circle`), 18px instead of 16 (18 is the *line height*),
 * and no tracking.
 */
const LABEL_4 = 'font-circle text-base leading-[18px] font-medium tracking-[-0.32px]';

/** Hovered-position earnings stat: values keep the stat treatment, dashes go secondary. */
const figureClass = (figure: Maybe<EarningsFigure> | null | undefined) =>
  cn(LABEL_4, figure?.status === 'ok' ? undefined : 'text-textSecondary');

function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    // `lg:flex-1` + `min-w-0`: from lg the footer is a flex row of equal
    // columns split by hairlines (APP-443 item 7), so each stat has to claim
    // its share rather than size to content.
    <div className="flex min-w-0 flex-col gap-1.5 lg:flex-1">
      {/* Body 6 — Graphik 12/18. `captionSm` is the 12px Graphik variant; the
          comp's 18px line height has no variant, so it rides in className. */}
      <Text variant="captionSm" className="text-textSecondary leading-[18px]">
        {label}
      </Text>
      {value}
    </div>
  );
}

function StatValue({ children }: { children: ReactNode }) {
  return <span className={cn(LABEL_4, 'text-text')}>{children}</span>;
}

/**
 * Mirrors the loaded card's per-tier order so nothing jumps as data lands. Keeps
 * its own `md:gap-6` (the loaded card uses gap-8) so spacing from md up stays as
 * it was before the reorder. `w-72 max-w-full` likewise preserves the bar's
 * 288px intrinsic width — which is what sizes the column on desktop, since a
 * percentage width contributes nothing to max-content — while still fitting a
 * 360 phone.
 */
function EarningsSkeleton() {
  return (
    <div className="mt-6 flex flex-col gap-10 md:gap-8 lg:flex-row lg:justify-between">
      <div className={cn(COLUMN, 'md:gap-6')}>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-10 w-72 max-w-full rounded" />
        </div>
        <div className={cn(LEGEND, 'flex flex-col gap-3')}>
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
      </div>
      <Skeleton
        className={cn(DONUT, 'mx-auto h-40 w-40 shrink-0 rounded-full md:h-[178px] md:w-[178px] lg:mx-0')}
        data-testid="earnings-skeleton-donut"
      />
    </div>
  );
}
