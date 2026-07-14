import { formatNumber } from '@/utils';

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
  tooltipLabel?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  symbol,
  isPercentage,
  labelFormatter,
  prefix,
  tooltipLabel
}: CustomTooltipProps) {
  const isMin = payload?.some(entry => entry.payload?.isMin === true);
  const isMax = payload?.some(entry => entry.payload?.isMax === true);

  if (!active || !payload?.length || !label) return null;

  // Series label — the point's own tooltipLabel wins over the chart-level one.
  const seriesLabel = payload[0]?.payload?.tooltipLabel || tooltipLabel;

  // DS Charts/Line tooltip (Figma 5273:12162): date header over a
  // series-dot · label · value row.
  return (
    <div className="bg-container min-w-40 rounded-xl p-3 shadow-lg backdrop-blur-[50px]">
      <p className="text-textSecondary mb-2 text-xs">{labelFormatter(label)}</p>
      {/* 🔶 the mock trails each row with an accent circle (green/amber) — omitted, semantics unclear. */}
      {payload.map((entry, i) => (
        <div key={`tooltip-value-item-${i}`} className="flex items-center gap-4">
          <span className="text-textSecondary flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            {seriesLabel}
          </span>
          <span className="text-text ml-auto text-sm font-medium">
            {prefix || ''}
            {`${formatNumber(entry.value)}${symbol && !isPercentage ? ` ${symbol}` : ''}${isPercentage ? '%' : ''}`}
          </span>
        </div>
      ))}
      {(isMin || isMax) && <p className="text-textSecondary mt-1 text-xs">{isMin ? 'Min' : 'Max'}</p>}
    </div>
  );
}
