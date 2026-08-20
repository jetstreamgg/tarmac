import { RefObject, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { formatNumber } from '@/utils';
import { TokenIconStack } from './TokenIconStack';
import { HOVER_EASE, HOVER_TRACK_MS } from './chartMotion';

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
  const x = anchor.left + coordinate.x + (flipX ? -CURSOR_OFFSET - panelSize.width : CURSOR_OFFSET);
  // The panel rides the top of the plot instead of the point's own height. The
  // comp animates the tooltip on x only (Figma 1598:76196 has no y track), and
  // it is what the reference app does: a panel pinned to one line never covers
  // the part of the series you are reading, and the eye stops having to chase
  // it up and down while scrubbing.
  const y = anchor.top + CURSOR_OFFSET;

  return {
    panelRef,
    style: {
      position: 'absolute',
      left: 0,
      top: 0,
      // Transform, not left/top, so the move is compositor-driven. Timing
      // matches the dot and rule (Chart.tsx): the panel names the point they
      // mark, so it has to arrive with them rather than trail like the lit
      // window. It replaces a 400ms ease-out inherited from recharts' own
      // wrapper, which left the panel behind all of them.
      transform: `translate(${x}px, ${y}px)`,
      transition: placed && !reduceMotion ? `transform ${HOVER_TRACK_MS}ms ${HOVER_EASE}` : 'none'
    } as const
  };
}

/*
 * The panel's date and value used to trade places on a ~100ms crossfade (the
 * comp fades them over ~96ms — Figma 1598:76197/76206). It is gone: while
 * scrubbing, the figures are what the user is reading, and fading each swap
 * leaves them mid-opacity most of the time, which is harder to read rather
 * than smoother. The reference app the annotation names updates its tooltip
 * text instantly. Deliberate deviation from the comp, on the user's call.
 */

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
        {labelFormatter(label)}
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
              {prefix || ''}
              {`${formatNumber(entry.value)}${symbol && !isPercentage && !hasTokenIcon ? ` ${symbol}` : ''}${isPercentage ? '%' : ''}`}
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
