import { ExternalLink, Globe } from 'lucide-react';
import { formatLargeNumber, formatPercentage, getRiskLevel } from '../../utils/starTokenUtils';
import type { StarToken } from '../../types/starToken';
import { cn } from '@/lib/utils';

interface StarTokenCardProps {
  token: StarToken;
  onSelect?: () => void;
  isSelected?: boolean;
}

export function StarTokenCard({ token, onSelect, isSelected }: StarTokenCardProps) {
  const riskLevel = getRiskLevel(token.rrc, token.exposure);

  const getRiskBadgeClasses = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border bg-white p-4 transition-all hover:shadow-lg',
        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200',
        onSelect && 'cursor-pointer'
      )}
      onClick={onSelect}
    >
      {isSelected && (
        <div className="absolute right-2 top-2">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            Selected
          </span>
        </div>
      )}

      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{token.symbol}</h3>
          <p className="text-sm text-gray-500">{token.name}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {token.protocol}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Globe className="h-3 w-3" />
            {token.network}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Total Value Locked</p>
            <p className="text-sm font-semibold text-gray-900">{formatLargeNumber(token.exposure)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Risk Capital</p>
            <p className="text-sm font-semibold text-gray-900">{formatLargeNumber(token.rrc)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Exposure Share</p>
            <p className="text-sm font-semibold text-gray-900">{formatPercentage(token.exposureShare)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Risk Level</p>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                getRiskBadgeClasses(riskLevel)
              )}
            >
              {riskLevel}
            </span>
          </div>
        </div>

        {token.revenue && (
          <div className="border-t pt-3">
            <p className="text-xs text-gray-500">Revenue (ASC)</p>
            <p className="text-sm font-semibold text-gray-900">{formatLargeNumber(token.revenue)}</p>
          </div>
        )}
      </div>

      {token.assetAddress && (
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="text-xs text-gray-500">Asset: {token.assetSymbol || 'N/A'}</div>
          <a
            href={`https://etherscan.io/address/${token.assetAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            onClick={e => e.stopPropagation()}
          >
            View Contract
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {onSelect && (
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-blue-600 p-2 text-center text-sm font-medium text-white transition-transform group-hover:translate-y-0">
          Click to select this token
        </div>
      )}
    </div>
  );
}
