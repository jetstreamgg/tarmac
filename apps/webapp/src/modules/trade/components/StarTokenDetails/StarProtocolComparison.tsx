import { useState, useCallback, useMemo } from 'react';
import { formatLargeNumber, formatPercentage } from '../../utils/starTokenUtils';
import type { StarProtocolStats } from '../../types/starToken';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { QueryParams } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';

interface StarProtocolComparisonProps {
  protocolStats: StarProtocolStats[];
}

type SortKey =
  | 'name'
  | 'totalExposure'
  | 'totalRRC'
  | 'totalRiskCapital'
  | 'riskToleranceRatio'
  | 'exposureShare'
  | 'tokenCount'
  | 'totalAsc'
  | 'ascShare';
type SortDirection = 'asc' | 'desc' | null;

export function StarProtocolComparison({ protocolStats }: StarProtocolComparisonProps) {
  const [, setSearchParams] = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleProtocolSelect = useCallback(
    (protocolName: string) => {
      // Map protocol names to token symbols
      const tokenMap: { [key: string]: string } = {
        Spark: 'SPK',
        Grove: 'GRV'
      };

      const tokenSymbol = tokenMap[protocolName];
      if (tokenSymbol) {
        setSearchParams(prev => {
          prev.set(QueryParams.TargetToken, tokenSymbol);
          return prev;
        });
      }
    },
    [setSearchParams]
  );

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        // Cycle through: null -> asc -> desc -> null
        if (sortDirection === null) {
          setSortDirection('asc');
        } else if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else {
          setSortDirection(null);
          setSortKey(null);
          return;
        }
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
    },
    [sortKey, sortDirection]
  );

  const sortedProtocolStats = useMemo(() => {
    if (!sortKey || !sortDirection) {
      return protocolStats;
    }

    return [...protocolStats].sort((a, b) => {
      let aValue: any = a[sortKey as keyof StarProtocolStats];
      let bValue: any = b[sortKey as keyof StarProtocolStats];

      // Handle numeric values
      if (typeof aValue === 'string' && !isNaN(parseFloat(aValue))) {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      }

      // Handle null/undefined values
      if (aValue == null) aValue = 0;
      if (bValue == null) bValue = 0;

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [protocolStats, sortKey, sortDirection]);

  if (!protocolStats || protocolStats.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <Text variant="small" className="text-gray-500">
          No protocol data available
        </Text>
      </div>
    );
  }

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    const isActive = sortKey === columnKey;
    const direction = isActive ? sortDirection : null;

    return (
      <span className="ml-1 inline-flex flex-col">
        <ChevronUp className={cn('-mb-1 h-3 w-3', direction === 'asc' ? 'text-gray-900' : 'text-gray-400')} />
        <ChevronDown className={cn('h-3 w-3', direction === 'desc' ? 'text-gray-900' : 'text-gray-400')} />
      </span>
    );
  };

  const metrics = [
    {
      label: 'TVL',
      key: 'totalExposure' as SortKey,
      formatter: formatLargeNumber,
      description: 'Total Value Locked'
    },
    {
      label: 'Risk Capital',
      key: 'totalRRC' as SortKey,
      formatter: formatLargeNumber,
      description: 'Risk Capital Required'
    },
    {
      label: 'Total Capital',
      key: 'totalRiskCapital' as SortKey,
      formatter: formatLargeNumber,
      description: 'Total Risk Capital'
    },
    {
      label: 'Risk Ratio',
      key: 'riskToleranceRatio' as SortKey,
      formatter: formatPercentage,
      description: 'Risk Tolerance Ratio'
    },
    {
      label: 'Market Share',
      key: 'exposureShare' as SortKey,
      formatter: formatPercentage,
      description: 'Exposure Share'
    },
    {
      label: 'Tokens',
      key: 'tokenCount' as SortKey,
      formatter: (val: any) => val?.toString() || '0',
      description: 'Number of Tokens'
    },
    {
      label: 'Revenue',
      key: 'totalAsc' as SortKey,
      formatter: (val: any) => (val ? formatLargeNumber(val) : 'N/A'),
      description: 'ASC Revenue'
    },
    {
      label: 'ASC %',
      key: 'ascShare' as SortKey,
      formatter: (val: any) => (val ? formatPercentage(val) : 'N/A'),
      description: 'ASC Share'
    }
  ];

  return (
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[150px]">
              <Text variant="small" className="font-semibold">
                Name
              </Text>
            </TableHead>
            {metrics.map(metric => (
              <TableHead
                key={metric.key}
                className="cursor-pointer text-center"
                title={metric.description}
                onClick={() => handleSort(metric.key)}
              >
                <div className="flex items-center justify-center">
                  <Text variant="small">{metric.label}</Text>
                  <SortIcon columnKey={metric.key} />
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProtocolStats.map(protocol => {
            return (
              <TableRow key={protocol.star}>
                <TableCell className="font-semibold">
                  <div className="flex items-center gap-2">
                    <TokenIcon
                      token={{
                        symbol:
                          protocol.name === 'Spark'
                            ? 'SPK'
                            : protocol.name === 'Grove'
                              ? 'GRV'
                              : protocol.name,
                        name: protocol.name
                      }}
                      width={24}
                      className="h-6 w-6"
                    />
                    <Text>{protocol.name}</Text>
                  </div>
                </TableCell>
                {metrics.map(metric => {
                  const value = protocol[metric.key];
                  const formattedValue = metric.formatter(value || 0);

                  // Add color coding for risk ratio
                  let textColor = '';
                  if (metric.key === 'riskToleranceRatio' && value) {
                    const ratio = parseFloat(String(value));
                    textColor =
                      ratio < 0.75 ? 'text-green-600' : ratio < 0.85 ? 'text-yellow-600' : 'text-red-600';
                  }

                  return (
                    <TableCell key={`${protocol.star}-${metric.key}`} className="text-center">
                      <Text className={textColor || undefined}>{formattedValue}</Text>
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleProtocolSelect(protocol.name)}
                    className="text-xs"
                  >
                    Buy
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
