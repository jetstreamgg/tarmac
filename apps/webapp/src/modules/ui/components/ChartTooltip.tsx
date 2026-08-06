import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { formatNumber } from '@/utils';
import { TokenIconStack } from './TokenIconStack';
import { HOVER_EASE, HOVER_FADE_MS, HOVER_TRACK_MS } from './chartMotion';

/** Gap between the hover point and the panel — recharts' own default offset. */
const CURSOR_OFFSET = 10;

type Box = { left: number; top: number; width: number; height: number };
type Size = { width: number; height: number };

const sameBox = (a: Box | null, b: Box) =>
  !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

const sameSize = (a: Size | null, b: Size) => !!a && a.width === b.width && a.height === b.height;

/**
 * Places the panel at the hover point in viewport pixels.
 *
 * The tooltip renders into a body-level fixed layer rather than inside the
 * chart card (see `Chart.tsx`), so recharts hands over positioning entirely —
 * it applies none of its own transform when given a `portal`. Both boxes are
 * measured in a layout effect rather than read during render, and re-measured
 * on every hover move, so scrolling and resizing stay tracked.
 */
function useTooltipPlacement(
  coordinate: { x: number; y: number } | undefined,
  anchorRef: RefObject<HTMLElement | null> | undefined
) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // Only the panel's *size* is tracked, never its position: the panel carries
  // the placement transform, so storing its left/top would re-enter this hook
  // on every animated frame and spin forever.
  const [panelSize, setPanelSize] = useState<Size | null>(null);
  const [anchor, setAnchor] = useState<Box | null>(null);
  // Whether a previous render already placed the panel. Until one has, the
  // glide is off — otherwise the first hover animates the panel in from the
  // layer's origin, i.e. across the page from the top-left corner.
  const [placed, setPlaced] = useState(false);

  const positioned = Boolean(coordinate && anchorRef && anchor && panelSize);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel) {
      const { width, height } = panel.getBoundingClientRect();
      setPanelSize(prev => (sameSize(prev, { width, height }) ? prev : { width, height }));
    }
    const host = anchorRef?.current;
    if (host) {
      const rect = host.getBoundingClientRect();
      const next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      setAnchor(prev => (sameBox(prev, next) ? prev : next));
    }
    if (positioned) setPlaced(true);
  });

  if (!coordinate || !anchorRef) return { panelRef, style: undefined };

  // First paint after activation has no measurements yet — keep the panel out
  // of sight for that frame instead of flashing it at the layer's origin.
  if (!anchor || !panelSize)
    return { panelRef, style: { position: 'absolute', visibility: 'hidden' } as const };

  // Flip to the other side of the cursor when the panel would leave the plot,
  // which is what recharts does with the default allowEscapeViewBox.
  const flipX = coordinate.x + CURSOR_OFFSET + panelSize.width > anchor.width;
  const flipY = coordinate.y + CURSOR_OFFSET + panelSize.height > anchor.height;
  const x = anchor.left + coordinate.x + (flipX ? -CURSOR_OFFSET - panelSize.width : CURSOR_OFFSET);
  const y = anchor.top + coordinate.y + (flipY ? -CURSOR_OFFSET - panelSize.height : CURSOR_OFFSET);

  return {
    panelRef,
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      // Transform, not left/top, so the move is compositor-driven. The timing
      // is shared with the cursor, dot and lit window (Chart.tsx) because the
      // comp moves all four as one — they leave and land together, on quart.
      // It replaces a 400ms ease-out inherited from recharts' own wrapper,
      // which left the panel trailing the rest of the hover chrome.
      transform: `translate(${x}px, ${y}px)`,
      transition: placed && !reduceMotion ? `transform ${HOVER_TRACK_MS}ms ${HOVER_EASE}` : 'none'
    } as const
  };
}

/**
 * Trades one value for another on a ~100ms crossfade (the comp fades its date
 * and amount over ~96ms, out on quart and in on easeInOut).
 *
 * Both copies are stacked in one grid cell so they overlap while they trade —
 * a sequential fade would read as a flicker, and floating one copy out of flow
 * would collapse the panel's width mid-move.
 */
function Crossfade({ tokenKey, children }: { tokenKey: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <span className="grid">
      <AnimatePresence initial={false} mode="sync">
        <motion.span
          key={tokenKey}
          className="col-start-1 row-start-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // The comp fades the outgoing copy on quart and the incoming one on
          // easeInOut, so the exit carries its own curve.
          exit={{ opacity: 0, transition: { duration: HOVER_FADE_MS / 1000, ease: [0.77, 0, 0.175, 1] } }}
          transition={{ duration: HOVER_FADE_MS / 1000, ease: [0.5, 0, 0.5, 1] }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    color: string;
    value: number;
    payload: { isMin?: boolean; isMax?: boolean; tooltipLabel?: string };
  }[];
  label?: Date;
  symbol?: string;
  isPercentage?: boolean;
  labelFormatter: (tickItem: Date) => string;
  prefix?: string;
  tooltipLabel?: React.ReactNode;
  /** Token(s) the series represents; renders the trailing token icon(s). Omit
   * for non-token series (e.g. a Rate/% metric) to render no trailing icon. */
  tokenSymbols?: string[];
  /** Hover point in chart pixel space — recharts passes this to `content`. */
  coordinate?: { x: number; y: number };
  /** The chart's plot box, for turning `coordinate` into viewport pixels.
   *  Omit to render the panel in place (unit tests, previews). */
  anchorRef?: RefObject<HTMLElement | null>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  symbol,
  isPercentage,
  labelFormatter,
  prefix,
  tooltipLabel,
  tokenSymbols,
  coordinate,
  anchorRef
}: CustomTooltipProps) {
  const { panelRef, style } = useTooltipPlacement(coordinate, anchorRef);
  const isMin = payload?.some(entry => entry.payload?.isMin === true);
  const isMax = payload?.some(entry => entry.payload?.isMax === true);

  if (!active || !payload?.length || !label) return null;

  // Series label — the point's own tooltipLabel wins over the chart-level one.
  const seriesLabel = payload[0]?.payload?.tooltipLabel || tooltipLabel;

  // When a token icon trails the value, it carries the unit — so drop the text
  // symbol suffix to match the DS (Figma 5273:12162: bare value + icon).
  const hasTokenIcon = !!tokenSymbols && tokenSymbols.length > 0;

  // DS Charts/Line tooltip (Figma 5273:12162): date header over a
  // series-dot · label · value · token-icon row. The leading dot carries the
  // series color; the trailing icon is the series' own token logo.
  //
  // Chrome is the app tooltip's (APP-443 item 19): bg-tertiary glass at 16px
  // radius behind the DS "background blur-full" effect, whose Figma radius of
  // 200 is CSS `blur(100px)` (Figma states background blur at twice the CSS
  // value). It used to be the opaque `bg-container` panel at 12px radius.
  return (
    <div
      ref={panelRef}
      style={style}
      className="bg-bgTertiary flex min-w-40 flex-col gap-1 rounded-2xl p-3 backdrop-blur-[100px]"
      data-testid="chart-tooltip"
    >
      <p className="text-fgPrimary font-circle text-xs leading-3.5 font-medium tracking-[-0.24px]">
        <Crossfade tokenKey={labelFormatter(label)}>{labelFormatter(label)}</Crossfade>
      </p>
      {payload.map((entry, i) => (
        <div key={`tooltip-value-item-${i}`} className="flex items-center gap-4">
          {seriesLabel != null && (
            <span
              className="text-fgSecondary flex items-center gap-1.5 text-xs leading-[18px]"
              data-testid="chart-tooltip-series-label"
            >
              {/* 4px square-ish swatch, not the old 8px dot. */}
              <span
                className="size-1 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              {seriesLabel}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1">
            <span className="text-fgPrimary font-circle text-xs leading-3.5 font-medium tracking-[-0.24px]">
              <Crossfade tokenKey={String(entry.value)}>
                {prefix || ''}
                {`${formatNumber(entry.value)}${symbol && !isPercentage && !hasTokenIcon ? ` ${symbol}` : ''}${isPercentage ? '%' : ''}`}
              </Crossfade>
            </span>
            {tokenSymbols && tokenSymbols.length > 0 && (
              <TokenIconStack
                symbols={tokenSymbols}
                size={12}
                className="shrink-0"
                data-testid="chart-tooltip-token-icon"
              />
            )}
          </span>
        </div>
      ))}
      {(isMin || isMax) && <p className="text-fgSecondary text-xs leading-[18px]">{isMin ? 'Min' : 'Max'}</p>}
    </div>
  );
}
