import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { tabsListVariants, tabsTriggerVariants } from '@/components/ui/tabs';
import { cn } from '@/lib/cn';
import { HStack } from '@/modules/layout/components/HStack';
import { formatNumber } from '@/utils';
import { useMemo, useState, useRef, useEffect, useId } from 'react';
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
import { AnimatePresence, motion } from 'motion/react';
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

const CustomizedLabel = (
  /*{
  x = 0,
  y = 0,
  stroke = 'black',
  value,
  index,
  data
}: {
  x?: number;
  y?: number;
  stroke?: string;
  value?: any;
  index?: number;
  data?: Data[];
}*/
) => {
  // TODO: We're returning null until we figure out how to show the labels without clipping on the X or Y edges
  return null;
  // if (!data?.length || index === undefined || (!data[index]?.isMin && !data[index]?.isMax)) return null;

  // const isMin = data[index]?.isMin;

  // // Only return a label for the max and min
  // return (
  //   <text
  //     x={index === 0 ? x + 6 : x}
  //     y={y}
  //     dy={isMin ? 16 : -8}
  //     fill={stroke}
  //     fontSize={13}
  //     textAnchor="middle"
  //   >
  //     {formatNumber(value)}
  //   </text>
  // );
};

const CustomizedDot = ({
  cx,
  cy,
  stroke,
  data,
  index
}: {
  cx?: number;
  cy?: number;
  stroke?: string;
  value?: any;
  index?: number;
  data?: Data[];
  fill?: string;
}) => {
  if (!data?.length || index === undefined || (!data[index]?.isMin && !data[index]?.isMax)) return null;

  // Only return a label for the max and min
  return <circle cx={cx} cy={cy} r="4" stroke={stroke} fillOpacity={1} strokeWidth="2" fill={stroke} />;
};

/** How much of the series' alpha survives past the hover cursor (DS Line hover). */
const POST_CURSOR_ALPHA = 0.4;

/**
 * DS Line hover (Figma 5273:12162): the plotted series keeps full strength up
 * to the hover cursor and dims past it. Implemented as a luminance mask on the
 * Area — white keeps the series, gray fades stroke+fill together — so the
 * dimming can't veil the glass card background the way an overlay rect would.
 * Rendered inside the AreaChart, where recharts' chart-context hooks resolve.
 */
export function HoverDimMask({ id }: { id: string }) {
  const isActive = useIsTooltipActive();
  const coordinate = useActiveTooltipCoordinate();
  const width = useChartWidth();
  const height = useChartHeight();
  // Pre-layout the chart has no dimensions (and no hover); fall back to a
  // full-coverage white mask so the series never flashes hidden.
  const cursorX = isActive && coordinate && width != null ? coordinate.x : null;

  return (
    <defs>
      <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width ?? '100%'} height={height ?? '100%'}>
        <rect
          data-testid="chart-dim-mask-lit"
          x={0}
          y={0}
          width={cursorX ?? width ?? '100%'}
          height={height ?? '100%'}
          fill="white"
        />
        {cursorX != null && width != null && (
          <rect
            data-testid="chart-dim-mask-dimmed"
            x={cursorX}
            y={0}
            width={Math.max(width - cursorX, 0)}
            height={height ?? '100%'}
            fill="white"
            opacity={POST_CURSOR_ALPHA}
          />
        )}
      </mask>
    </defs>
  );
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
  return (
    <div className={cn(tabsListVariants({ variant: 'segmented' }), className)} data-testid={dataTestId}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          data-state={value === option.value ? 'active' : 'inactive'}
          className={cn(tabsTriggerVariants({ variant: 'segmented' }), itemClassName)}
        >
          {option.label}
        </button>
      ))}
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
  /** detail variant: metric toggle options (e.g. Rate | TVL). */
  metrics?: { value: string; label: React.ReactNode }[];
  activeMetric?: string;
  onMetricChange?: (value: string) => void;
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
  mobile = false
}: {
  data: Data[];
  displayValue?: number;
  isPercentage: boolean;
  symbol?: string;
  prefix?: string;
  isLoading: boolean;
  /** M6.3 mobile figure: Heading 5 (24/26, Circular Medium). */
  mobile?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-9 w-32" />;
  }
  const value = displayValue ?? data[data.length - 1]?.value ?? 0;
  const formatted = `${prefix || ''}${formatNumber(value, { maxDecimals: 2, compact: true })}${
    isPercentage ? '%' : symbol ? ` ${symbol}` : ''
  }`;
  return (
    <span
      data-testid="chart-detail-value"
      className={cn(
        'text-text text-2xl',
        mobile ? 'font-circle leading-[26px] font-medium tracking-[-0.48px]' : 'font-semibold lg:text-[28px]'
      )}
    >
      {formatted}
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
  color
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
}) {
  const { bpi } = useBreakpointIndex();
  const gradientId = useId();
  const dimMaskId = useId();

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
      {/* Fade the plot in over the skeleton's last frame so the swap reads as
          one transition instead of a hard cut (APP-399 #6). */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <ResponsiveContainer width={'100%'} height={resolvedHeight}>
          <AreaChart
            data={data}
            margin={{ top: isLarge ? 12 : 30, right: 0, bottom: isLarge ? 22 : 0, left: 0 }}
          >
            <defs>
              <linearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2="0"
                y2="100%"
                gradientUnits="objectBoundingBox"
              >
                {color ? (
                  <>
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="75%" stopColor={color} stopOpacity="0" />
                  </>
                ) : (
                  <>
                    <stop offset="5%" stopColor="#1DD9BA" stopOpacity={0.25} />
                    <stop offset="75%" stopColor="#00A167" stopOpacity="0" />
                  </>
                )}
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
              // DS hover cursor: a faint dashed vertical rule (Figma 5273:12162).
              cursor={{ stroke: 'var(--color-fgQuaternary)', strokeWidth: 1, strokeDasharray: '4 4' }}
              content={
                <ChartTooltip
                  symbol={symbol}
                  isPercentage={isPercentage}
                  labelFormatter={date => formatDate(date, activeTimeframe)}
                  prefix={prefix}
                  tooltipLabel={tooltipLabel}
                  tokenSymbols={tokenSymbols}
                />
              }
            />

            <Area
              dataKey="value"
              stroke={color ?? '#1DD9BA'}
              strokeWidth={2.5}
              type="monotone"
              fill={`url(#${gradientId})`}
              // Dim the series past the hover cursor (mask above); the active dot
              // and tooltip render outside the masked layer, so they stay lit.
              mask={`url(#${dimMaskId})`}
              label={<CustomizedLabel /*data={data} stroke="var(--transparent-white-40)"*/ />}
              dot={<CustomizedDot data={data} stroke={color ?? '#1DD9BA'} />}
              // Ringed hover dot at the cursor point (Figma 5273:12162).
              activeDot={{ r: 5, fill: color ?? '#1DD9BA', stroke: 'var(--color-container)', strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
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
  metrics,
  activeMetric,
  onMetricChange,
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
        className={cn(
          'relative overflow-hidden p-0',
          isDetail ? (isMobileDetail ? 'pb-5' : 'pb-3') : 'bg-cardLight h-[288px] lg:h-[220px] lg:p-0'
        )}
        ref={containerRef}
      >
        <CardHeader className="p-5 pb-0">
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
                />
              </div>
            </div>
          ) : isDetail ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                {label && (
                  <span className="text-selectActive light:text-textSecondary text-[13px] leading-none">
                    {label}
                  </span>
                )}
                <DetailHeaderValue
                  data={data}
                  displayValue={displayValue}
                  isPercentage={isPercentage}
                  symbol={symbol}
                  prefix={prefix}
                  isLoading={isLoading}
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
          className={cn(isMobileDetail && 'px-5')}
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
            chartHeight={isDetail ? (isMobileDetail ? 203 : 280) : undefined}
            tooltipLabel={resolveTooltipLabel(tooltipLabel, metrics, activeMetric)}
            tokenSymbols={tokenSymbols}
            color={color}
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
