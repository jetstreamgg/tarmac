import { ChevronUp, ChevronDown } from 'lucide-react';
import { formatLargeNumber, formatPercentage, getRiskLevel } from '../../utils/starTokenUtils';
import type { StarToken, SortKey } from '../../types/starToken';
import { cn } from '@/lib/utils';

interface StarTokenTableProps {
  tokens: StarToken[];
  onSort: (key: SortKey) => void;
  onTokenSelect: (token: StarToken) => void;
  sortBy: SortKey;
  sortOrder: 'asc' | 'desc';
  selectedToken: StarToken | null;
}

export function StarTokenTable({
  tokens,
  onSort,
  onTokenSelect,
  sortBy,
  sortOrder,
  selectedToken
}: StarTokenTableProps) {
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) {
      return <span className="ml-1 inline-block w-4 text-gray-400">⇅</span>;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="ml-1 inline-block h-4 w-4" />
    ) : (
      <ChevronDown className="ml-1 inline-block h-4 w-4" />
    );
  };

  const SortableHeader = ({ column, children }: { column: SortKey; children: React.ReactNode }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon column={column} />
      </div>
    </th>
  );

  if (tokens.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">No tokens found matching your criteria</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader column="protocol">Protocol</SortableHeader>
              <SortableHeader column="name">Token</SortableHeader>
              <SortableHeader column="network">Network</SortableHeader>
              <SortableHeader column="exposure">TVL</SortableHeader>
              <SortableHeader column="rrc">Risk Capital</SortableHeader>
              <SortableHeader column="exposureShare">Exposure %</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Risk Level
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {tokens.map((token, index) => {
              const riskLevel = getRiskLevel(token.rrc, token.exposure);
              const isSelected =
                selectedToken?.symbol === token.symbol && selectedToken?.protocol === token.protocol;

              return (
                <tr
                  key={`${token.protocol}-${token.symbol}-${index}`}
                  onClick={() => onTokenSelect(token)}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-gray-50',
                    isSelected && 'bg-blue-50 hover:bg-blue-100'
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {token.protocol}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-gray-500">{token.name}</div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                      {token.network}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {formatLargeNumber(token.exposure)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {formatLargeNumber(token.rrc)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {formatPercentage(token.exposureShare)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        riskLevel === 'low' && 'bg-green-100 text-green-800',
                        riskLevel === 'medium' && 'bg-yellow-100 text-yellow-800',
                        riskLevel === 'high' && 'bg-red-100 text-red-800'
                      )}
                    >
                      {riskLevel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tokens.length > 10 && (
        <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500">Showing {tokens.length} tokens</div>
      )}
    </div>
  );
}
