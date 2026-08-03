import { formatNumber } from '@/utils';
import { TokenIconStack } from './TokenIconStack';

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
  tokenSymbols
}: CustomTooltipProps) {
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
    <div className="bg-bgTertiary flex min-w-40 flex-col gap-1 rounded-2xl p-3 backdrop-blur-[100px]">
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
