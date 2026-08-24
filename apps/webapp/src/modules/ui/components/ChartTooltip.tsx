import { RefObject, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { formatNumber } from '@/utils';
import { TokenIconStack } from './TokenIconStack';
import { useFollow } from './chartMotion';

/** Gap between the hover point and the panel. Wider than recharts' default 10
 *  so the panel stands clear of the series instead of crowding it. */
const CURSOR_OFFSET = 18;

/** Extra clearance under the panel's band before it flips to the plot floor. */
const FLIP_CLEARANCE = 24;

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
  // Only the panel's *size* is tracked, never its position: the panel carries
  // the placement transform, so storing its left/top would re-enter this hook
  // on every animated frame and spin forever.
  const [panelSize, setPanelSize] = useState<Size | null>(null);
  const [anchor, setAnchor] = useState<Box | null>(null);

  const ready = !!coordinate && !!anchorRef && !!anchor && !!panelSize;

  // Flip to the other side of the cursor when the panel would leave the plot,
  // which is what recharts does with the default allowEscapeViewBox.
  const flipX = ready && coordinate.x + CURSOR_OFFSET + panelSize.width > anchor.width;
  const x = ready
    ? anchor.left + coordinate.x + (flipX ? -CURSOR_OFFSET - panelSize.width : CURSOR_OFFSET)
    : null;
  // The panel rides the top of the plot instead of the point's own height. The
  // comp animates the tooltip on x only (Figma 1598:76196 has no y track), and
  // it is what the reference app does: a panel pinned to one line never covers
  // the part of the series you are reading, and the eye stops having to chase
  // it up and down while scrubbing. The one exception: when the series itself
  // climbs into the panel's band at the cursor, the panel drops to the plot
  // floor rather than sit on the line — the follower glides it between lanes.
  const flipY = ready && coordinate.y < CURSOR_OFFSET + panelSize.height + FLIP_CLEARANCE;
  const y = ready
    ? anchor.top + (flipY ? anchor.height - CURSOR_OFFSET - panelSize.height : CURSOR_OFFSET)
    : null;

  // The panel names the point the dot and rule mark, so it shares their time
  // constant and arrives with them rather than trailing like the lit window.
  // `useFollow` owns `transform`; it must stay out of the style prop below.
  const panelRef = useFollow<HTMLDivElement>(x, y);

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
  });

  if (!coordinate || !anchorRef) return { panelRef, style: undefined };

  // First paint after activation has no measurements yet — keep the panel out
  // of sight for that frame instead of flashing it at the layer's origin.
  if (!ready) return { panelRef, style: { position: 'absolute', visibility: 'hidden' } as const };

  return { panelRef, style: { position: 'absolute', left: 0, top: 0 } as const };
}

/**
 * Ends the hover when the interaction has clearly moved on — the page scrolled,
 * or a press landed outside the plot.
 *
 * On touch there is no mouseleave, so a tapped tooltip outlives the tap: the
 * portal layer is position:fixed and the anchor box is only re-measured on
 * recharts re-renders, so once the page scrolls the panel rides the viewport
 * away from the chart. Recharts (3.x) clears its hover store from exactly one
 * place — a mouseleave on its wrapper div — so this synthesizes that event.
 * `relatedTarget` is the wrapper's parent, which scopes React's enter/leave
 * synthesis to the wrapper alone (no ancestor sees a leave it didn't have).
 * The whole hover ensemble (panel, cursor, dot, dim and lit segment) reads that
 * one store, so it all leaves together through its usual crossfade.
 */
/**
 * Whether a press that STARTED inside the plot is still down. While it is, the
 * finger is scrubbing: scroll dismissal is suppressed (a drag with vertical
 * drift also scrolls the page, and dismissing on those scrolls fought
 * recharts' touchmove reactivation frame by frame) and the panel holds through
 * recharts' own micro-deactivations (see the hold in `ChartTooltip`). State,
 * not a ref, so the hold can release on the lift; tracked in its own hook so a
 * mid-gesture flicker of the tooltip's active flag cannot reset it.
 */
function usePressedInsidePlot(anchorRef: RefObject<HTMLElement | null> | undefined): boolean {
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const host = anchorRef?.current;
    if (!host) return;
    const onPointerDown = (event: PointerEvent) => {
      setPressed(event.target instanceof Node && host.contains(event.target));
    };
    const endPress = () => setPressed(false);
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointerup', endPress, { capture: true });
    window.addEventListener('pointercancel', endPress, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', endPress, { capture: true });
      window.removeEventListener('pointercancel', endPress, { capture: true });
    };
  }, [anchorRef]);

  return pressed;
}

function useDismissHoverAway(
  shown: boolean,
  anchorRef: RefObject<HTMLElement | null> | undefined,
  pressedInside: boolean
) {
  useEffect(() => {
    if (!shown) return;
    const host = anchorRef?.current;
    const wrapper = host?.querySelector('.recharts-wrapper');
    if (!host || !wrapper) return;

    const dismiss = () =>
      wrapper.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: wrapper.parentElement ?? undefined })
      );
    const onScroll = () => {
      // Scrubbing wins while the finger is down; the lift hands the next
      // scroll (momentum included) back to the dismissal.
      if (!pressedInside) dismiss();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !host.contains(event.target)) dismiss();
    };

    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
    };
  }, [shown, anchorRef, pressedInside]);
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
  const pressedInside = usePressedInsidePlot(anchorRef);
  const live = useMemo(
    () => (active && payload?.length && label ? { payload, label, coordinate } : null),
    [active, payload, label, coordinate]
  );
  // While the finger that started on the plot is still down, hold the last
  // shown datum through recharts' micro-deactivations: a scrub that drifts off
  // the plot band deactivates and reactivates the tooltip per frame, and
  // unmounting the panel each time blinked the card and its token icon. The
  // lift releases the hold — an inactive tooltip then hides as before.
  const [held, setHeld] = useState<typeof live>(null);
  useEffect(() => {
    if (!live) return;
    // Same datum → keep the previous snapshot, so this cannot loop on the new
    // object recharts hands over every render.
    setHeld(prev =>
      prev &&
      prev.label.getTime() === live.label.getTime() &&
      prev.coordinate?.x === live.coordinate?.x &&
      prev.coordinate?.y === live.coordinate?.y
        ? prev
        : live
    );
  }, [live]);
  const shown = live ?? (pressedInside ? held : null);

  const { panelRef, style } = useTooltipPlacement(shown?.coordinate, anchorRef);
  useDismissHoverAway(!!shown, anchorRef, pressedInside);
  const isMin = shown?.payload.some(entry => entry.payload?.isMin === true);
  const isMax = shown?.payload.some(entry => entry.payload?.isMax === true);

  if (!shown) return null;

  // Series label — the point's own tooltipLabel wins over the chart-level one.
  const seriesLabel = shown.payload[0]?.payload?.tooltipLabel || tooltipLabel;

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
        {labelFormatter(shown.label)}
      </p>
      {shown.payload.map((entry, i) => (
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
