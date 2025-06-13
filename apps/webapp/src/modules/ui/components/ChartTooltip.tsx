import { formatNumber } from '@jetstreamgg/sky-utils';

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    color: string;
    value: number;
    payload: { isMin?: boolean; isMax?: boolean };
  }[];
  label?: Date;
  symbol?: string;
  isPercentage?: boolean;
  labelFormatter: (tickItem: Date) => string;
  prefix?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  symbol,
  isPercentage,
  labelFormatter,
  prefix
}: CustomTooltipProps) {
  const isMin = payload?.some(entry => entry.payload?.isMin === true);
  const isMax = payload?.some(entry => entry.payload?.isMax === true);

  return !active || !payload || !payload.length || !label ? null : (
    <div>
      <div className="bg-container rounded-[6px] p-2">
        <p>{labelFormatter(label)}</p>
        {payload.map((entry, i) => (
          <div key={`tooltip-value-item-${i}`}>
            <div className="flex items-center space-x-2">
              {prefix || ''}
              {`${formatNumber(entry.value)}${symbol && !isPercentage ? ` ${symbol}` : ''}${isPercentage ? '%' : ''}`}
            </div>
            {(isMin || isMax) && (
              <div className="flex items-center space-x-2">{isMin ? 'Min' : isMax ? 'Max' : ''}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
