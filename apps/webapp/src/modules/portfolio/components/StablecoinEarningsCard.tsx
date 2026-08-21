import { Children, Fragment, ReactNode, isValidElement, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { cn } from '@/lib/cn';
import { BP, useBreakpointIndex } from '@/hooks';
import { formatDecimalPercentage, formatUsd, projectAnnualEarnings } from '@/utils';
import { Card } from '@/components/ui/card';
import { GainValue } from '@/components/ui/GainValue';
import { RollingValue } from '@/components/ui/rolling-value';
import { Skeleton } from '@/components/ui/skeleton';
import { Heading, Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { IconStack } from '@/modules/ui/components/TokenIconStack';
import type { SuppliedView } from '../helpers/suppliedView';
import type { IdleView } from '../helpers/idleView';
import { PortfolioDonutChart, type DonutSegment } from './PortfolioDonutChart';
import { PortfolioTabs, type PortfolioTab } from './PortfolioTabs';

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

/**
 * Entrance (Figma 2233:61099, t=0 is the data landing): the headline rises
 * into place at 300ms, the legend rows and footer stats slide in from the
 * right from 300ms — rows 100ms apart, stats 50ms apart — and the token
 * badges pop in from 400ms, 100ms apart, while the donut sweeps its arcs
 * (timed inside PortfolioDonutChart). Everything runs 300ms on ease-out.
 * Replays whenever the tab content mounts, which is what the comp shows for
 * "content arriving"; nothing re-runs on hover or data refresh.
 */
const ENTRANCE_START = 0.3;
const ENTRANCE_SECONDS = 0.3;
const LEGEND_STAGGER = 0.1;
const STAT_STAGGER = 0.05;
const BADGES_START = 0.4;
const HEADLINE_RISE = 22;
const LEGEND_TRAVEL = 20;
const STAT_TRAVEL = 25;

/** Slide-in from `x`, `delay` seconds after the data lands. Returns the
 * motion props; reduced motion renders the resting state outright. */
function useEntrance() {
  const prefersReducedMotion = useReducedMotion();
  return (offset: { x?: number; y?: number }, delay: number) => ({
    initial: prefersReducedMotion ? false : { opacity: 0, x: offset.x ?? 0, y: offset.y ?? 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    transition: { duration: ENTRANCE_SECONDS, ease: 'easeOut', delay } satisfies Transition
  });
}

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
  tab: PortfolioTab;
  onTabChange: (tab: PortfolioTab) => void;
}) {
  return (
    <Card className="p-6 md:p-8" data-testid="stablecoin-earnings-card">
      <PortfolioTabs tab={tab} onTabChange={onTabChange} />

      {tab === 'idle' ? (
        <IdleContent view={idleView} savingsRate={savingsRate} isLoading={idleLoading} />
      ) : (
        <SuppliedContent view={suppliedView} isLoading={suppliedLoading} />
      )}
    </Card>
  );
}

function SuppliedContent({ view, isLoading }: { view: SuppliedView; isLoading: boolean }) {
  // Hovering a position (legend or chart) focuses the card on it: totals and
  // footer stats collapse to that single position's values.
  const [activeId, setActiveId] = useState<string | null>(null);
  const donutSize = useDonutSize();
  const entrance = useEntrance();

  if (isLoading && view.positions.length === 0) return <EarningsSkeleton />;

  const activePosition = activeId ? view.positions.find(p => p.id === activeId) : undefined;
  const activeSymbol = activePosition?.tokenSymbol ?? null;
  const displayTotal = activePosition ? activePosition.amountUsd : view.totalSupplied;
  const displayProjected = activePosition
    ? projectAnnualEarnings(activePosition.amountUsd, activePosition.rate)
    : view.projected1Y;
  const displayAvgRate = activePosition ? (activePosition.rate ?? 0) : view.avgRate;
  // Positions settle before the rate APIs — hold the rate-derived stats rather
  // than quote 0.00% / $0.00 in the gap.
  const ratesPending = activePosition ? activePosition.rateLoading : view.ratesLoading;

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
            {view.positions.map((position, index) => {
              const pct = position.share * 100;
              const pctLabel = pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`;
              return (
                <motion.li
                  key={position.id}
                  {...entrance({ x: LEGEND_TRAVEL }, ENTRANCE_START + index * LEGEND_STAGGER)}
                >
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
                </motion.li>
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
        {/* TODO(D1): Total earned / Earned this month need a cost-basis source (no hook yet). */}
        <Stat label={<Trans>Total accrued</Trans>} value={<TodoValue />} />
        <Stat label={<Trans>Accrued this month</Trans>} value={<TodoValue />} />
        <Stat
          label={<Trans>Projected 1Y yield (at current rate)</Trans>}
          value={
            ratesPending ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              <GainValue value={displayProjected} className={LABEL_4} rolling />
            )
          }
        />
        <Stat
          label={<Trans>Avg. Rate</Trans>}
          value={
            ratesPending ? (
              <Skeleton className="h-4 w-14" />
            ) : (
              <StatValue>{formatDecimalPercentage(displayAvgRate)}</StatValue>
            )
          }
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
  const entrance = useEntrance();

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
            {view.tokens.map((token, index) => (
              <motion.li
                key={token.symbol}
                {...entrance({ x: LEGEND_TRAVEL }, ENTRANCE_START + index * LEGEND_STAGGER)}
              >
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
              </motion.li>
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
            key="rate"
            label={<Trans>Sky Savings Rate</Trans>}
            value={<StatValue>{formatDecimalPercentage(savingsRate)}</StatValue>}
          />
        )}
        {displayProjected !== undefined && (
          <Stat
            key="projected"
            label={<Trans>Projected 1Y yield (at current rate)</Trans>}
            value={<GainValue value={displayProjected} className={LABEL_4} rolling />}
          />
        )}
        <Stat
          key="count"
          label={<Trans>Idle stablecoins</Trans>}
          value={<StatValue>{view.idleCount}</StatValue>}
        />
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
  const entrance = useEntrance();
  // Badge cluster: 24 on phones per the comp (486:20137), the desktop 28 from md.
  const iconSize = bpi < BP.md ? 24 : 28;

  return (
    <div className="flex flex-col gap-2">
      <Text variant="medium" className="text-textSecondary">
        {label}
      </Text>
      <div className="flex items-center gap-3">
        {/* 32/35 on phones per the comp (486:20136), the desktop 40 from md.
            The figure rolls over on hover focus (Figma 1598:76582) and its box
            re-sizes with it, so the badge cluster glides along to its next
            spot rather than jumping. */}
        <Heading
          tag="h2"
          className="text-text font-circle text-[32px] leading-[35px] md:text-[40px] md:leading-none"
        >
          <motion.span className="inline-block" {...entrance({ y: HEADLINE_RISE }, ENTRANCE_START)}>
            <RollingValue value={formatUsd(value)} />
          </motion.span>
        </Heading>
        {/* Focusing a position dims the other badges (the stack keeps them
            opaque under a scrim, so nothing shows through the overlap). */}
        <IconStack
          size={iconSize}
          animateIn={{ delay: BADGES_START }}
          activeIndex={activeSymbol ? tokenSymbols.indexOf(activeSymbol) : null}
        >
          {tokenSymbols.map(symbol => (
            <TokenIcon
              key={symbol}
              token={{ symbol }}
              width={iconSize}
              showChainIcon={false}
              className="h-full w-full"
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
      // Dim/undim on a 300ms ease-out (Figma 2233:61099 legend rows).
      className={cn(
        'flex items-center gap-3 text-left transition-opacity duration-300 ease-out',
        dimmed && 'opacity-50'
      )}
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
  const entrance = useEntrance();
  return (
    <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:flex lg:gap-8">
      {/* Keyed by the Stat's own key where it has one: the Idle footer's first
          two stats are conditional, and an index key would hand a slot (and
          its already-played entrance) to whichever stat shifts into it. */}
      {stats.map((stat, index) => (
        <Fragment key={isValidElement(stat) && stat.key !== null ? stat.key : index}>
          {index > 0 && <span className="bg-borderPrimary hidden h-7 w-px shrink-0 self-center lg:block" />}
          {/* From lg the footer packs left — content-width stats 32px apart,
              split by hairlines (Figma 2376:225116 → I…;5034:39291, "Align
              stats to the left side"). This supersedes APP-443 item 7, which
              had each stat claim an equal share of the row (`lg:flex-1`) and
              so pushed the last one out to the card's right edge. `min-w-0`
              stays so a long figure truncates instead of overflowing. */}
          <motion.div
            className="min-w-0"
            {...entrance({ x: STAT_TRAVEL }, ENTRANCE_START + index * STAT_STAGGER)}
          >
            {stat}
          </motion.div>
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

function Stat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    // Sizing (lg:flex-1 / min-w-0) lives on the FooterStats wrapper that
    // animates this in.
    <div className="flex min-w-0 flex-col gap-1.5">
      {/* Body 6 — Graphik 12/18. `captionSm` is the 12px Graphik variant; the
          comp's 18px line height has no variant, so it rides in className. */}
      <Text variant="captionSm" className="text-textSecondary leading-[18px]">
        {label}
      </Text>
      {value}
    </div>
  );
}

/** A footer figure; rolls over when it changes (hover focus). */
function StatValue({ children }: { children: string | number }) {
  return (
    <span className={cn(LABEL_4, 'text-text')}>
      <RollingValue value={children} speed="stat" />
    </span>
  );
}

function TodoValue() {
  return <span className={cn(LABEL_4, 'text-textSecondary')}>TODO</span>;
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
