import { useStarTokenData } from '../../hooks/useStarTokenData';
import { StarProtocolComparison } from './StarProtocolComparison';

export function StarTokenDetails() {
  const { data, isLoading, error, isError } = useStarTokenData();

  if (isLoading) {
    return <StarTokenDetailsSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h3 className="font-semibold text-red-800">Error loading Star tokens</h3>
        <p className="mt-1 text-sm text-red-600">{error?.message || 'Failed to load token data'}</p>
      </div>
    );
  }

  if (!data || !data.protocolStats.length) {
    return <div className="py-8 text-center text-gray-500">No Star protocol data available</div>;
  }

  return (
    <div className="space-y-6">
      <StarProtocolComparison protocolStats={data.protocolStats} />
    </div>
  );
}

function StarTokenDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="rounded-lg bg-gray-100 p-3">
              <div className="mb-2 h-3 w-20 rounded bg-gray-200"></div>
              <div className="h-5 w-24 rounded bg-gray-200"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="animate-pulse">
        <div className="mb-4 h-10 w-full rounded bg-gray-100"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-gray-100"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
