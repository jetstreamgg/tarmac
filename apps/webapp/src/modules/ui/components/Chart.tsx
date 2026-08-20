import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { RateBadge } from '@/components/ui/RateBadge';
import { RollingValue } from '@/components/ui/rolling-value';
import { tabsListVariants, tabsTriggerVariants } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { HStack } from '@/modules/layout/components/HStack';
import { formatNumber } from '@/utils';
import { useMemo, useState, useRef, useEffect, useId, useCallback } from 'react';
import {
  Area,
  AreaChart,
  XAxis,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  useActiveTooltipCoordinate,
  useChartHeight,
  useChartWidth,
  useIsTooltipActive
} from 'recharts';
import { format } from 'date-fns';
import { Text } from '@/modules/layout/components/Typography';
import { ChartTooltip } from './ChartTooltip';
import { HOVER_EASE, HOVER_TRACK_MS } from './chartMotion';
import { BP, useBreakpointIndex } from '@/hooks';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { easeOutExpo } from '../animation/timingFunctions';
import { positionAnimations } from '../animation/presets';
import { AnimationLabels } from '../animation/constants';
import { LoadingErrorWrapper } from './LoadingErrorWrapper';
import { Trans } from '@lingui/react/macro';
import { VStack } from '@/modules/layout/components/VStack';
import { Warning } from '@/modules/icons/Warning';

const dateFormat = 'MMM d';
const monthFormat = 'MMM y';

export type TimeFrame = 'w' | 'm' | 'y' | 'all';

const TimeframeControls = ({
  activeTimeframe,
  bpi,
  setActiveTimeframe,
  onTimeFrameChange,
  compact
}: {
  activeTimeframe: TimeFrame;
  setActiveTimeframe: (tf: TimeFrame) => void;
  onTimeFrameChange?: (tf: TimeFrame) => void;
  bpi: BP;
  compact: boolean;
}) => {
  const keys: TimeFrame[] = ['w', 'm', 'y', 'all'];

  if (bpi < BP.lg || compact) {
    return (
      <Select
        onValueChange={(tfKey: TimeFrame) => {
          setActiveTimeframe(tfKey);
          onTimeFrameChange?.(tfKey);
        }}
        defaultValue={activeTimeframe}
      >
        <SelectTrigger className="bg-chartSelect w-[70px] rounded-xl border-none">
          <SelectValue defaultValue="w" />
        </SelectTrigger>
        <SelectContent align="end" className="bg-chartSelect text-text w-[70px] rounded-xl border-none">
          <SelectGroup>
            {keys.map(tfKey => (
              <SelectItem key={tfKey} value={tfKey} className="w-[70px]">
                {tfKey === 'all' ? 'All' : `1${tfKey.toUpperCase()}`}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  return (
    <HStack className="text-selectActive light:text-text flex" gap={2}>
      {keys.map(tfKey => (
        <Button
          variant="ghost"
          key={tfKey}
          className={
            activeTimeframe === tfKey
              ? 'text-text light:bg-[rgb(125,108,242)] light:hover:bg-[rgb(125,108,242)] light:active:bg-[rgb(125,108,242)] bg-[rgb(60,50,122)] hover:bg-[rgb(60,50,122)] active:bg-[rgb(60,50,122)]'
              : ''
          }
          onClick={() => {
            setActiveTimeframe(tfKey);
            onTimeFrameChange?.(tfKey);
          }}
        >
          {tfKey === 'all' ? 'All' : `1${tfKey.toUpperCase()}`}
        </Button>
      ))}
    </HStack>
  );
};

/*
 * There used to be a `label={<CustomizedLabel />}` on the Area here, rendering
 * one element per data point to draw min/max markers. It had been returning
 * `null` since before the redesign (the DS plots the bare line — APP-443 item
 * 19 removed the resting markers for good), but recharts still built one React
 * element per point on every render, and the chart re-renders on every
 * mousemove. On the All range that was ~2600 throwaway elements per pointer
 * frame: dropping it took the median hover frame from 24.8ms to 17.3ms and cut
 * dropped frames from 18 to 6 over a full-width sweep.
 */

/**
 * DS Charts/Line geometry (Figma 5273:12162), read off the exported vectors.
 * The resting series carries NO plotted points — the only dot the chart ever
 * shows is the ringed one under the hover cursor (APP-443 item 19); the min/max
 * markers it used to draw are gone.
 */
const SERIES_STROKE_WIDTH = 1.5;
/** Hover dot: 12px overall — r 5.25 under a 1.5 ring in the series colour. */
const ACTIVE_DOT_RADIUS = 5.25;

/**
 * Every hover element tracks on `transform`, never on SVG geometry: `x1`/`x2`
 * on a line are not CSS properties at all, and `x`/`width` only became
 * animatable with SVG 2 geometry properties. One mechanism across all of them,
 * working everywhere the app already runs. Timing is shared with the tooltip —
 * see `chartMotion.ts` for why the comp's own durations are not used.
 */
const trackTransition = (property: string, reduceMotion: boolean | null) =>
  reduceMotion ? undefined : `${property} ${HOVER_TRACK_MS}ms ${HOVER_EASE}`;

/**
 * Travel below which the glide is dropped and the element simply follows the
 * pointer.
 *
 * The glide exists to smooth the *jump* between two far-apart data points: on
 * 1W the series plots ~8 points across ~780px, so the cursor snaps ~90px at a
 * time and easing that reads as tracking. Dense series invert the maths — 1Y
 * steps ~6px and All ~0.3px — and there the target moves every frame, so a
 * 120ms transition never completes: the dot, rule and lit window are
 * permanently mid-glide and trail the pointer by up to 120ms of travel. That
 * lag is what reads as "sharp"/laggy, and it is worst exactly where the user
 * noticed it (1Y and All).
 *
 * The reference the annotation points at (app.perena.org/transparency) runs its
 * hover indicators with no positional transition whatsoever — its smoothness is
 * 1:1 tracking, not easing. This keeps the comp's glide where it does something
 * and takes perena's behaviour where it doesn't.
 */
const SNAP_BELOW_PX = 12;

/**
 * `trackTransition`, but dropped once the hover target is moving in steps too
 * small for a glide to be anything but latency. Call unconditionally — it holds
 * a hook.
 */
function useTrackingTransition(property: string, position: number | null | undefined) {
  const reduceMotion = useReducedMotion();
  const glide = trackTransition(property, reduceMotion);
  // Derived-state-on-prop-change rather than a ref: the decision has to be made
  // from the *previous* position, and reading a ref during render is exactly
  // what `react-hooks/refs` forbids. React re-runs this pass with the new state
  // before committing, so the value returned below is never the stale one.
  const [tracked, setTracked] = useState<{ at: number | null | undefined; transition?: string }>({
    at: position,
    transition: glide
  });

  if (tracked.at !== position) {
    const jumped = tracked.at == null || position == null || Math.abs(position - tracked.at) >= SNAP_BELOW_PX;
    setTracked({ at: position, transition: jumped ? glide : undefined });
  }

  return reduceMotion ? undefined : tracked.transition;
}

/**
 * The ringed dot under the hover cursor (Figma 5273:12162).
 *
 * Its core is drawn twice: an opaque page-background disc under the
 * `statusBrandBg` tint. The tint alone is 10% alpha, so the series and the
 * dashed hover cursor both read straight through the dot — the comp draws it
 * solid.
 *
 * The circles sit at the origin and the group carries the position, so the dot
 * can track the hover on `transform` — including the vertical travel as it
 * rides the series (the comp moves it 13px in y over the same keyframes).
 */
export function ActiveDot({ cx, cy, color }: { cx?: number; cy?: number; color?: string }) {
  const transition = useTrackingTransition('transform', cx);
  if (cx == null || cy == null) return null;
  return (
    <g
      data-testid="chart-active-dot"
      style={{
        transform: `translate(${cx}px, ${cy}px)`,
        transition
      }}
    >
      <circle r={ACTIVE_DOT_RADIUS} fill="var(--color-pageBackground)" />
      <circle
        r={ACTIVE_DOT_RADIUS}
        fill="var(--color-statusBrandBg)"
        stroke={color}
        strokeWidth={SERIES_STROKE_WIDTH}
      />
    </g>
  );
}

/**
 * The dashed hover rule (Figma 5273:12162), as a custom cursor so it can track
 * on `transform`: recharts' default cursor is a `<Curve>` positioned by its
 * `points`, which land on `x1`/`x2` and cannot be transitioned.
 */
export function HoverCursor({
  points,
  height,
  top
}: {
  points?: { x: number; y: number }[];
  height?: number;
  top?: number;
}) {
  const start = points?.[0];
  const end = points?.[1];
  const transition = useTrackingTransition('transform', start?.x);
  if (!start) return null;
  return (
    <line
      data-testid="chart-hover-cursor"
      x1={0}
      x2={0}
      y1={start.y ?? top ?? 0}
      y2={end?.y ?? (top ?? 0) + (height ?? 0)}
      stroke="var(--color-borderQuarternary)"
      strokeWidth={1}
      strokeDasharray="3 3"
      strokeLinecap="round"
      pointerEvents="none"
      style={{
        transform: `translateX(${start.x}px)`,
        transition
      }}
    />
  );
}

/** How much of the series' alpha survives outside the hover window (DS Line hover). */
const POST_CURSOR_ALPHA = 0.4;

/**
 * The series' entrance reveal (Figma: Sky App: UI 1598:77307, where the plot
 * grows from 1px to its full 760px width). recharts draws exactly that by
 * default — `AreaRevealShape` wipes the curve in left-to-right behind an
 * animated clip-path — so this only re-times it from recharts' 1500ms/`ease`
 * to the comp's figures.
 *
 * The easing has to be spelled out rather than read from `--ease-in-out-quart`:
 * recharts parses the string itself to build an easing function, so it never
 * reaches CSS where a custom property would resolve.
 *
 * No delay is paired with this. The reveal is gated by data, not by the clock —
 * `LoadingErrorWrapper` holds the skeleton until a series exists, so the Area
 * mounts (and wipes in) only once there is something to draw, which in practice
 * lands after any page transition has finished.
 */
const REVEAL_DURATION_MS = 900;
/**
 * The same wipe, replayed when the series is swapped for another one — the
 * Rate|TVL switch in the tabs comp (Figma: Sky App: UI 1598:76322), where the
 * outgoing series fades over ~230ms and the incoming one draws itself in over
 * ~600ms. recharts carries a single animationDuration for both the first
 * reveal and every replay, so the component steps it down once the opening
 * wipe has finished.
 */
const RE_REVEAL_DURATION_MS = 600;
const REVEAL_EASING = 'cubic-bezier(0.77,0,0.175,1)';

/** The active pill's slide between segments (tabs comp): 151ms, easeInOut. */
const PILL_SLIDE = { duration: 0.15, ease: [0.42, 0, 0.58, 1] } as const;

/**
 * Half-width of the lit window, in px — the DS mock's mask measures 45px across
 * (Figma 5391:44830).
 *
 * It is a flat number rather than the distance to the neighbouring data points
 * the ticket describes, because the series are far denser than they look: the
 * Morpho rate chart plots 170 hourly points over 779px at 1W and 722 at 1M, so
 * neighbours sit 1–5px apart and a point-relative window would light little
 * more than the hover dot. Charts sparse enough for it to matter (the portfolio
 * protocol statistics, 7–8 points) would swing the other way and light a third
 * of the plot. One width keeps every chart reading alike.
 */
const HALF_WINDOW = 22;

/**
 * DS Line hover (Figma 5273:12162): the plotted series dims and only a window
 * around the hover point stays at full strength. Implemented as a luminance
 * mask on the Area — white keeps the series, gray fades stroke+fill together —
 * so the dimming can't veil the glass card background the way an overlay rect
 * would. Rendered inside the AreaChart, where recharts' chart-context hooks
 * resolve.
 */
export function HoverDimMask({ id }: { id: string }) {
  const isActive = useIsTooltipActive();
  const coordinate = useActiveTooltipCoordinate();
  const width = useChartWidth();
  const height = useChartHeight();
  const reduceMotion = useReducedMotion();
  // Pre-layout the chart has no dimensions (and no hover); fall back to a
  // full-coverage white mask so the series never flashes hidden.
  const cursorX = isActive && coordinate && width != null ? coordinate.x : null;
  const litTransition = useTrackingTransition('transform', cursorX);

  return (
    <defs>
      <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width ?? '100%'} height={height ?? '100%'}>
        <rect
          data-testid="chart-dim-mask-base"
          x={0}
          y={0}
          width={width ?? '100%'}
          height={height ?? '100%'}
          fill="white"
          opacity={cursorX != null ? POST_CURSOR_ALPHA : 1}
          style={{ transition: trackTransition('opacity', reduceMotion) }}
        />
        {cursorX != null && (
          /* Full-width window translated into place rather than clamped by
             recomputing x/width: the mask region is the plot box, so a window
             that overhangs an edge is clipped to exactly what clamping used to
             leave visible — and holding the geometry still is what lets the
             boundary travel with the cursor on `transform`. */
          <rect
            data-testid="chart-dim-mask-lit"
            x={0}
            y={0}
            width={HALF_WINDOW * 2}
            height={height ?? '100%'}
            fill="white"
            style={{
              transform: `translateX(${cursorX - HALF_WINDOW}px)`,
              transition: litTransition
            }}
          />
        )}
      </mask>
    </defs>
  );
}

/** Id of the body-level layer every chart tooltip renders into. */
const TOOLTIP_PORTAL_ID = 'chart-tooltip-portal';

/**
 * The layer the chart tooltip is portalled into (APP-443 item 19.1).
 *
 * Rendered inside the chart card, the tooltip's `backdrop-filter` has nothing
 * to work with: the card carries its own `backdrop-blur`, which makes it a
 * backdrop root, and a nested backdrop-filter then samples an empty backdrop —
 * so the plot showed straight through the panel unblurred. Hoisting it to the
 * body puts it in the same position as every other app tooltip, which is
 * portalled by Radix, and the frost resolves against the page.
 */
function useChartTooltipPortal(): HTMLElement | null {
  const [portal, setPortal] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let element = document.getElementById(TOOLTIP_PORTAL_ID);
    if (!element) {
      element = document.createElement('div');
      element.id = TOOLTIP_PORTAL_ID;
      // z-101 matches the app tooltip tier — above the z-100 popovers.
      element.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:101';
      document.body.appendChild(element);
    }
    setPortal(element);
  }, []);

  return portal;
}

const formatedXAxis = (data: Data[], tf: TimeFrame, bpi: BP) => {
  if (!data.length) {
    return [];
  }
  const steps = bpi < BP.lg ? 4 : 7;
  const stepSize = (data.length - 1) / (steps - 1);

  const filteredData = [data[0]]; // Always include the first element

  // Generate indices for intermediate steps
  for (let i = 1; i < steps - 1; i++) {
    const idx = Math.round(stepSize * i);
    filteredData.push(data[idx]);
  }

  filteredData.push(data[data.length - 1]); // Always include the last element

  const finalFormat = ['y', 'all'].includes(tf) ? monthFormat : dateFormat;
  return filteredData.map(item => format(new Date(item.date?.toISOString()), finalFormat));
};

const formatDate = (date: Date, tf: TimeFrame) => {
  const finalFormat = ['y', 'all'].includes(tf) ? monthFormat : dateFormat;
  return format(date, finalFormat);
};

export type Data = {
  value: number;
  date: Date;
  isMin?: boolean;
  isMax?: boolean;
  tooltipLabel?: string;
};

const TIMEFRAME_OPTIONS: { value: TimeFrame; label: string }[] = [
  { value: 'w', label: '1W' },
  { value: 'm', label: '1M' },
  { value: 'y', label: '1Y' },
  { value: 'all', label: 'All' }
];

/**
 * Segmented pill group used by the `detail` variant header (the Rate|TVL
 * metric toggle and the timeframe toggle) — the design-system Tabs2 family
 * (Figma 5039:73501), reusing the tabs recipes via manual data-state since
 * this is a plain button group, not a Radix Tabs tree.
 */
function SegmentedPills<T extends string>({
  options,
  value,
  onChange,
  dataTestId,
  className,
  itemClassName
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  dataTestId?: string;
  /** Extra classes on the pill group (e.g. `w-full` for the M6.3 mobile bars). */
  className?: string;
  /** Extra classes on each pill (e.g. `flex-1` to split the width evenly). */
  itemClassName?: string;
}) {
  // One shared layout element per group, so switching segments slides the
  // active fill across instead of repainting it in place. The id scopes the
  // shared element to this group — a page renders several of these (metric and
  // timeframe, plus their mobile counterparts) and a duplicated layoutId would
  // make pills fly between groups.
  const pillId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn(tabsListVariants({ variant: 'segmented' }), className)} data-testid={dataTestId}>
      {options.map(option => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            data-state={isActive ? 'active' : 'inactive'}
            className={cn(
              tabsTriggerVariants({ variant: 'segmented' }),
              // The recipe paints the active fill and border on the trigger
              // itself; the travelling element below owns them here. Suppressed
              // locally rather than in the recipe, which other non-Radix groups
              // still rely on.
              'relative data-[state=active]:border-transparent data-[state=active]:bg-none',
              itemClassName
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`${pillId}-active-pill`}
                aria-hidden
                // No negative z-index: the group paints its own well
                // (bg-pageBackground), and a -z-10 fill sits behind THAT and
                // disappears entirely. Stacking is by DOM order instead — the
                // fill is positioned and comes first, the label is positioned
                // and comes after, so the label wins.
                className="border-borderBrandDim from-brand2-start to-brand2-end absolute inset-0 rounded-full border bg-linear-to-b bg-origin-border"
                transition={reduceMotion ? { duration: 0 } : PILL_SLIDE}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The tooltip's series label: the explicit chart-level label when given,
 * otherwise the active metric's pill label (detail variant) — so a Rate|TVL
 * chart never renders the DS tooltip row with an empty label cell.
 */
export function resolveTooltipLabel(
  tooltipLabel: React.ReactNode,
  metrics?: { value: string; label: React.ReactNode }[],
  activeMetric?: string
): React.ReactNode {
  return tooltipLabel ?? metrics?.find(metric => metric.value === activeMetric)?.label;
}

interface ChartProps {
  data: Data[];
  symbol?: string;
  prefix?: string;
  isPercentage?: boolean;
  hidePercentChange?: boolean;
  onTimeFrameChange?: (tf: TimeFrame) => void;
  isLoading?: boolean;
  error?: Error | null;
  dataTestId?: string;
  displayValue?: number;
  tooltipLabel?: React.ReactNode;
  icons?: React.ReactNode;
  /** Token(s) the series represents; drives the tooltip's trailing token
   * icon(s). Omit for non-token series (e.g. a Rate/% metric). */
  tokenSymbols?: string[];
  /** 'detail' switches to the product-detail header (label + value + Rate|TVL toggle). */
  variant?: 'default' | 'detail';
  /** detail variant: small label above the value (e.g. "Current Rate"). */
  label?: React.ReactNode;
  /** detail variant: mark rendered after the headline figure (e.g. the Morpho
   *  vault chart's stars mark, which also carries the rate-breakdown tooltip). */
  valueSuffix?: React.ReactNode;
  /** detail variant: metric toggle options (e.g. Rate | TVL). */
  metrics?: { value: string; label: React.ReactNode }[];
  activeMetric?: string;
  onMetricChange?: (value: string) => void;
  /** detail variant: tag the headline with the period's change as a DS
   * Badges / Special pill (Figma 2376:225249). Opt-in — only the supply-style
   * series the comp draws it on wants it; a rate series does not. */
  showTrend?: boolean;
  /** Line/area color. Omit for the default teal; pass a hex to theme the series
   * (e.g. the Stake destination chart's brand indigo #757dff). */
  color?: string;
}

const formatPercentage = (percentage: number, isLarge: boolean) => {
  const formatted = `${formatNumber(percentage, { maxDecimals: 2, compact: isLarge ? false : true })}%`;
  if (formatted === '-0%') {
    return '0%';
  }
  return formatted;
};

function CardTitleContent({
  data,
  isLarge,
  isPercentage,
  symbol,
  prefix,
  percentage,
  formattedPercentage,
  isZeroPercentage,
  isLoading,
  hidePercentChange,
  displayValue,
  icons
}: {
  data: Data[];
  isLarge: boolean;
  isPercentage: boolean;
  symbol?: string;
  prefix?: string;
  percentage: number;
  formattedPercentage: string;
  isZeroPercentage: boolean;
  isLoading: boolean;
  hidePercentChange?: boolean;
  displayValue?: number;
  icons?: React.ReactNode;
}) {
  return (
    <LoadingErrorWrapper
      isLoading={isLoading}
      loadingComponent={
        <AnimatePresence mode="popLayout">
          <motion.div
            key="chart-loading"
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: easeOutExpo }}
          >
            <Skeleton className="h-8 w-56" />
          </motion.div>
        </AnimatePresence>
      }
      error={null}
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key="chart-loaded"
          variants={positionAnimations}
          initial={AnimationLabels.initial}
          animate={AnimationLabels.animate}
        >
          <HStack gap={2} className="h-8 items-end justify-start p-0">
            {icons && <span className="flex items-center self-center">{icons}</span>}
            <Text className="text-xl lg:text-2xl">
              {prefix || ''}
              {`${formatNumber(displayValue ?? data[data.length - 1]?.value ?? 0, {
                maxDecimals: 2,
                compact: true
              })}${isLarge && !isPercentage && symbol ? ` ${symbol}` : ''}${isPercentage ? '%' : ''}`}
            </Text>
            {!hidePercentChange && (
              <HStack
                gap={1}
                className={`items-center justify-center overflow-clip lg:max-w-none ${isZeroPercentage ? '' : percentage >= 0 ? 'text-bullish' : 'text-error'}`}
              >
                <Text className="max-w-28 text-base text-ellipsis lg:max-w-none lg:text-lg">
                  {percentage > 10000 ? (
                    <>
                      <span className="align-middle text-[0.6em]">▲</span> 10,000+%
                    </>
                  ) : percentage > 0 && !isZeroPercentage ? (
                    <>
                      <span className="align-middle text-[0.6em]">▲</span> {formattedPercentage}
                    </>
                  ) : percentage < 0 && !isZeroPercentage ? (
                    <>
                      <span className="align-middle text-[0.6em]">▼</span>{' '}
                      {formattedPercentage.replace('-', '')}
                    </>
                  ) : (
                    formattedPercentage
                  )}
                </Text>
              </HStack>
            )}
          </HStack>
        </motion.div>
      </AnimatePresence>
    </LoadingErrorWrapper>
  );
}

/** detail-variant headline: just the formatted value (no % change / timestamp). */
function DetailHeaderValue({
  data,
  displayValue,
  isPercentage,
  symbol,
  prefix,
  isLoading,
  icons,
  valueSuffix,
  trend,
  mobile = false
}: {
  data: Data[];
  displayValue?: number;
  isPercentage: boolean;
  symbol?: string;
  prefix?: string;
  isLoading: boolean;
  /** Optional mark(s) leading the figure — the Portfolio statistics comp
   *  (1036:189291) puts the series' token logo here. */
  icons?: React.ReactNode;
  /** Optional mark trailing the figure — the Morpho vault chart tags its rate
   *  with the DS stars mark the same way the card and Details row do. */
  valueSuffix?: React.ReactNode;
  /** Optional Badges / Special pill trailing the figure — the period's change
   *  (Figma 2376:225249, "missing trend badge"). */
  trend?: React.ReactNode;
  /** M6.3 mobile figure: Heading 5 (24/26, Circular Medium). */
  mobile?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-9 w-32" />;
  }
  const value = displayValue ?? data[data.length - 1]?.value ?? 0;
  // The token mark already names the series, so a figure that carries `icons`
  // drops the trailing symbol rather than saying it twice (Figma 2376:225248,
  // "Keep only icon instead fo USDS label").
  const unit = isPercentage ? '%' : symbol && !icons ? ` ${symbol}` : '';
  const formatted = `${prefix || ''}${formatNumber(value, { maxDecimals: 2, compact: true })}${unit}`;
  const figure = (
    <span
      data-testid="chart-detail-value"
      // Desktop is Heading 2 (44/48, Circular Medium — Figma 859:35718, whose
      // header block measures 22px of label over a 48px figure); the phone tier
      // keeps its own Heading 5 from M6.3.
      className={cn(
        'text-text font-circle font-medium',
        mobile
          ? 'text-2xl leading-[26px] tracking-[-0.48px]'
          : 'text-[44px] leading-[48px] tracking-[-0.88px]'
      )}
    >
      {/* The figure rolls over when the metric or timeframe swaps it rather
          than snapping (Figma 2376:225248 → 1598:76582, "Animate numbers"). It
          only ever changes discretely here — no caller drives it from hover. */}
      <RollingValue value={formatted} />
    </span>
  );
  if (!icons && !valueSuffix && !trend) return figure;
  return (
    <span className="flex items-center gap-2">
      {icons}
      {figure}
      {valueSuffix}
      {trend}
    </span>
  );
}

/**
 * DS Badges / Special carrying a period's change (Figma 2376:225249). Up takes
 * the success gradient `RateBadge` the comp draws; down mirrors its geometry in
 * the error token, which the comp never has to show but the data can produce.
 */
function TrendBadge({ percentage, formatted }: { percentage: number; formatted: string }) {
  const isDown = percentage < 0;
  const label = `${isDown ? '' : '+'}${formatted}`;
  if (!isDown) {
    return <RateBadge data-testid="chart-trend-badge">{label}</RateBadge>;
  }
  return (
    <span
      data-testid="chart-trend-badge"
      className="border-error/50 bg-error/10 text-error font-circle inline-flex shrink-0 items-center rounded-full border-[0.5px] px-1.5 py-[3px] text-[11px] leading-3 font-medium tracking-[-0.24px] md:text-xs md:leading-[14px]"
    >
      {label}
    </span>
  );
}

function ChartContent({
  data,
  isLarge,
  symbol,
  prefix,
  isPercentage,
  activeTimeframe,
  isLoading,
  error,
  tooltipLabel,
  tokenSymbols,
  chartHeight,
  color,
  seriesKey,
  isDetail = false
}: {
  data: Data[];
  isLarge: boolean;
  isPercentage: boolean;
  symbol?: string;
  prefix?: string;
  isLoading: boolean;
  activeTimeframe: TimeFrame;
  error?: Error | null;
  tooltipLabel?: React.ReactNode;
  tokenSymbols?: string[];
  chartHeight?: number;
  color?: string;
  /**
   * Identifies which series is plotted (metric + timeframe). Changing it
   * remounts the Area so the new series wipes in from the left, rather than
   * recharts interpolating the old curve into the new one — handed a new
   * dataset for the same Area, it morphs the path, which is not what the tabs
   * comp draws.
   */
  seriesKey?: string;
  /** detail variant: no date axis under the plot, so it runs to the card floor. */
  isDetail?: boolean;
}) {
  const { bpi } = useBreakpointIndex();
  const gradientId = useId();
  const dimMaskId = useId();
  // The opening wipe is the slower one; every replay after it — a metric or
  // timeframe switch, which recharts treats as a fresh entrance — runs at the
  // tabs comp's shorter figure. Stepped down when the first wipe reports done,
  // since recharts reads one duration for both.
  const [revealDuration, setRevealDuration] = useState(REVEAL_DURATION_MS);
  // Stable identity is load-bearing, not tidiness: recharts rebuilds the
  // running animation from zero whenever this handler's identity changes
  // (JavascriptAnimate lists onAnimationEnd in the deps of the effect that
  // constructs it). Inline, the wipe restarted on every re-render that landed
  // mid-reveal — on a cold load the series stuttered through two or three
  // false starts before the real one.
  const handleRevealEnd = useCallback(() => setRevealDuration(RE_REVEAL_DURATION_MS), []);
  const tooltipPortal = useChartTooltipPortal();
  // The plot box, so the portalled tooltip can turn recharts' chart-space
  // coordinate into viewport pixels.
  const plotRef = useRef<HTMLDivElement>(null);

  // components/charts/bg-chart2 unless the caller themes the series (e.g. the
  // Stake destination chart's bg-chart1 indigo).
  const seriesColor = color ?? 'var(--color-chart2)';

  // Single source of truth for the plot height so the loading skeleton
  // reserves the same space as the rendered chart (no layout shift on load).
  const resolvedHeight = chartHeight ?? (isLarge ? 220 : 288);

  return (
    <LoadingErrorWrapper
      isLoading={isLoading}
      loadingComponent={<ChartSkeleton height={resolvedHeight} />}
      error={error ? error : null}
      errorComponent={
        <VStack className="items-center pt-16 lg:pt-8">
          <Warning className="h-12 w-12" />
          <Text className="text-text text-center">
            <Trans>Unable to load chart data, please try again later.</Trans>
          </Text>
        </VStack>
      }
    >
      <div ref={plotRef}>
        <ResponsiveContainer width={'100%'} height={resolvedHeight}>
          <AreaChart
            data={data}
            margin={{ top: isLarge ? 12 : 30, right: 0, bottom: isDetail ? 0 : isLarge ? 22 : 0, left: 0 }}
          >
            <defs>
              {/* The area wash is one hue fading to nothing at the plot floor
                  (Figma 859:35718). It used to end at 75% — and, on the default
                  teal, to fade into a *different* hue (#00A167 green) — which is
                  what read as the wrong colour and the short gradient in APP-432
                  item 9. */}
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="100%"
                gradientUnits="objectBoundingBox"
              >
                <stop offset="0%" stopColor={seriesColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={seriesColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <HoverDimMask id={dimMaskId} />
            <YAxis
              domain={['dataMin', 'dataMax']}
              padding={{ top: 20, bottom: bpi > BP.md ? 20 : 40 }}
              hide
            />
            {/* We can't extract the XAxis component outside of the chart as in the designs */}
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={false} />
            {/* Uncomment tooltip if we want to track day by day with the mouse cursor */}
            <Tooltip
              // Out of the card so the panel's frost has a backdrop to sample
              // (see useChartTooltipPortal); the tooltip places itself.
              portal={tooltipPortal}
              // DS hover cursor: a faint dashed vertical rule (Figma 5273:12162 —
              // border-quaternary, 3/3 dashes with round caps), drawn by
              // HoverCursor so it tracks the hover with everything else.
              cursor={<HoverCursor />}
              content={
                <ChartTooltip
                  symbol={symbol}
                  isPercentage={isPercentage}
                  labelFormatter={date => formatDate(date, activeTimeframe)}
                  prefix={prefix}
                  tooltipLabel={tooltipLabel}
                  tokenSymbols={tokenSymbols}
                  anchorRef={plotRef}
                />
              }
            />

            <Area
              key={seriesKey}
              dataKey="value"
              stroke={seriesColor}
              strokeWidth={SERIES_STROKE_WIDTH}
              strokeLinecap="round"
              type="monotone"
              fill={`url(#${gradientId})`}
              // Dim everything outside the hover window (mask above); the active
              // dot renders outside the masked layer, so it stays lit.
              mask={`url(#${dimMaskId})`}
              // No resting points — the DS plots the bare line.
              dot={false}
              // Ringed hover dot at the cursor point (Figma 5273:12162).
              activeDot={<ActiveDot color={seriesColor} />}
              // Entrance wipe — see REVEAL_DURATION_MS. Leaving isAnimationActive
              // at its 'auto' default is deliberate: it resolves to off under
              // prefers-reduced-motion (and under SSR), so the reveal needs no
              // reduced-motion handling of its own.
              animationDuration={revealDuration}
              animationEasing={REVEAL_EASING}
              onAnimationEnd={handleRevealEnd}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </LoadingErrorWrapper>
  );
}

export function Chart({
  data,
  symbol,
  prefix,
  onTimeFrameChange,
  isPercentage = false,
  hidePercentChange = false,
  isLoading = false,
  error,
  dataTestId,
  displayValue,
  tooltipLabel,
  icons,
  tokenSymbols,
  variant = 'default',
  label,
  valueSuffix,
  metrics,
  activeMetric,
  onMetricChange,
  showTrend = false,
  color
}: ChartProps) {
  const isDetail = variant === 'detail';
  const containerRef = useRef<HTMLDivElement>(null);
  const { bpi } = useBreakpointIndex();
  const isLarge = bpi >= BP.lg;
  // M6.3 (Figma 486:20761): below md the detail card re-stacks — full-width
  // metric bar on top, label/value under it, inset 203px plot, full-width
  // timeframe bar at the bottom.
  const isMobileDetail = isDetail && bpi < BP.md;
  const percentage = useMemo(() => {
    if (data[0]?.value === undefined || data[data.length - 1]?.value === undefined) {
      return 0;
    }

    const offset = isPercentage ? 0.001 : 1;
    const first = data[0].value + offset;
    const last = data[data.length - 1].value + offset;

    return ((last - first) / first) * 100;
  }, [data, isPercentage]);
  const formattedPercentage = formatPercentage(percentage, isLarge);
  const isZeroPercentage = formattedPercentage.replace('-', '').replace(/%/g, '') === '0';
  // A flat period has no direction to report, so the pill drops out rather than
  // claiming "+0%"; so does a still-loading series, whose change is meaningless.
  //
  // A zero first sample is not a real starting level: `interpolateDataPoints`
  // seeds the window at 0 for any span that precedes the feed's first record,
  // which happens whenever the history is shorter than the timeframe. Measured
  // against it the change comes out in the billions of percent, so the pill
  // stays away rather than quote a number the series cannot support.
  const hasBaseline = (data[0]?.value ?? 0) > 0 || isPercentage;
  const trendBadge =
    showTrend && !isLoading && !isZeroPercentage && data.length > 1 && hasBaseline ? (
      <TrendBadge percentage={percentage} formatted={formattedPercentage.replace('-', '')} />
    ) : undefined;
  const [activeTimeframe, setActiveTimeframe] = useState<TimeFrame>('w');
  const [width, setWidth] = useState<number>(0);
  const dateAxis = formatedXAxis(data, activeTimeframe, bpi);

  useEffect(() => {
    const containerElement = containerRef.current;
    if (!containerElement) return;

    const updateSize = () => {
      const newWidth = containerElement.offsetWidth;
      setWidth(newWidth);
    };
    updateSize();

    // Create observer to watch for changes in card size
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerElement);

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <Card
        data-testid={dataTestId}
        // Desktop detail is the comp's 32px-padded block (859:35718: header at
        // 32/32, a 760-wide plot, 32px under it); the phone tier and the
        // default variant keep their own full-bleed plot inside a p-0 card.
        className={cn(
          'relative overflow-hidden',
          isDetail ? (isMobileDetail ? 'p-0 pb-5' : 'p-8') : 'bg-cardLight h-[288px] p-0 lg:h-[220px] lg:p-0'
        )}
        ref={containerRef}
      >
        <CardHeader className={cn(isDetail && !isMobileDetail ? 'p-0' : 'p-5 pb-0')}>
          {isMobileDetail ? (
            <div className="flex w-full flex-col gap-5">
              {metrics && activeMetric !== undefined && onMetricChange && (
                <SegmentedPills
                  options={metrics}
                  value={activeMetric}
                  onChange={onMetricChange}
                  dataTestId="chart-metric-toggle"
                  className="w-full"
                  itemClassName="flex-1"
                />
              )}
              <div className="flex flex-col gap-0.5">
                {label && <span className="text-textSecondary text-xs leading-[18px]">{label}</span>}
                <DetailHeaderValue
                  mobile
                  data={data}
                  displayValue={displayValue}
                  isPercentage={isPercentage}
                  symbol={symbol}
                  prefix={prefix}
                  isLoading={isLoading}
                  icons={icons}
                  valueSuffix={valueSuffix}
                  trend={trendBadge}
                />
              </div>
            </div>
          ) : isDetail ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col">
                {/* Body 5 on fg-secondary, flush against the figure (859:35718);
                    it was 13px on the selectActive periwinkle. */}
                {label && (
                  <span className="text-fgSecondary font-graphik text-sm leading-[22px]">{label}</span>
                )}
                <DetailHeaderValue
                  data={data}
                  displayValue={displayValue}
                  isPercentage={isPercentage}
                  symbol={symbol}
                  prefix={prefix}
                  isLoading={isLoading}
                  icons={icons}
                  valueSuffix={valueSuffix}
                  trend={trendBadge}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {metrics && activeMetric !== undefined && onMetricChange && (
                  <SegmentedPills
                    options={metrics}
                    value={activeMetric}
                    onChange={onMetricChange}
                    dataTestId="chart-metric-toggle"
                  />
                )}
                <SegmentedPills
                  options={TIMEFRAME_OPTIONS}
                  value={activeTimeframe}
                  onChange={tf => {
                    setActiveTimeframe(tf);
                    onTimeFrameChange?.(tf);
                  }}
                  dataTestId="chart-timeframe-toggle"
                />
              </div>
            </div>
          ) : (
            <HStack className="h-8 w-full items-center justify-between p-0">
              <CardTitle className="leading-loose">
                <CardTitleContent
                  data={data}
                  isLarge={isLarge}
                  isPercentage={isPercentage}
                  symbol={symbol}
                  prefix={prefix}
                  percentage={percentage}
                  formattedPercentage={formattedPercentage}
                  isZeroPercentage={isZeroPercentage}
                  isLoading={isLoading}
                  hidePercentChange={hidePercentChange}
                  displayValue={displayValue}
                  icons={icons}
                />
                <Text variant="chartSecondary">{format(new Date(), "EEE, MMM d 'at' h:mm a")}</Text>
              </CardTitle>
              <TimeframeControls
                bpi={bpi}
                compact={width < 600}
                activeTimeframe={activeTimeframe}
                setActiveTimeframe={setActiveTimeframe}
                onTimeFrameChange={onTimeFrameChange}
              />
            </HStack>
          )}
        </CardHeader>
        <div
          data-testid={dataTestId ? `${dataTestId}-plot` : undefined}
          className={cn(isMobileDetail && 'px-5', isDetail && !isMobileDetail && 'pt-2')}
        >
          <ChartContent
            data={data}
            isLarge={isLarge}
            symbol={symbol}
            prefix={prefix}
            isPercentage={isPercentage}
            activeTimeframe={activeTimeframe}
            isLoading={isLoading}
            error={error}
            isDetail={isDetail}
            chartHeight={isDetail ? (isMobileDetail ? 203 : 263) : undefined}
            tooltipLabel={resolveTooltipLabel(tooltipLabel, metrics, activeMetric)}
            tokenSymbols={tokenSymbols}
            color={color}
            seriesKey={`${activeMetric ?? ''}-${activeTimeframe}`}
          />
        </div>
        {isMobileDetail && (
          <div className="px-5 pt-5">
            <SegmentedPills
              options={TIMEFRAME_OPTIONS}
              value={activeTimeframe}
              onChange={tf => {
                setActiveTimeframe(tf);
                onTimeFrameChange?.(tf);
              }}
              dataTestId="chart-timeframe-toggle"
              className="w-full"
              itemClassName="flex-1"
            />
          </div>
        )}
      </Card>
      {/* Detail variant drops the x-axis date labels (Figma). */}
      {!isDetail && (
        <HStack className="mt-3 justify-between">
          {dateAxis.map((date, index) => (
            <Text
              className="text-selectActive light:text-textSecondary"
              variant="small"
              key={`${date}+${index}`}
            >
              {date}
            </Text>
          ))}
        </HStack>
      )}
    </>
  );
}
