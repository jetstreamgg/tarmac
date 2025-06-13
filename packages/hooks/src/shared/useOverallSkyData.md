# useOverallSkyData

Hook for fetching overall Sky ecosystem data.

## Import

Import the hook from '@jetstreamgg/sky-hooks'.

## Usage

Use this hook in your React components to fetch and display overall Sky ecosystem data. The hook provides data, error, and loading states.

```tsx
import { useOverallSkyData } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useOverallSkyData();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Overall Sky Data: {JSON.stringify(data)}</p>
    </div>
  );
}




## Parameters

This hook doesn't accept any parameters.

## Return Type

Returns an object extending ReadHook and containing:

- data: OverallSkyData | undefined
  - The fetched overall Sky ecosystem data.
- error: Error | undefined
  - Any error that occurred during the fetch.
- isLoading: boolean
  - Whether the fetch is currently loading.
- mutate: () => void
  - Function to manually refetch the data.
- dataSources: Array of objects containing information about the data sources used.

### OverallSkyData Type

The OverallSkyData type includes the following properties:

- skySavingsRatecRate: string
- skySavingsRateTvl: string
- usdsSkyCRate: string
- totalRewardTvl: string
- totalSavingsTvl: string
- skyEcosystemTvl: string
- skyEcosystemWalletCount: number
- skyPriceUsd: string
- usdcPriceUsd: string
- wethPriceUsd: string
- usdsPriceUsd: string
- usdtPriceUsd: string

## Notes

- This hook fetches data from the BA Labs API.
- The data includes various metrics related to the Sky ecosystem, including savings rates, TVL, wallet counts, and token prices.
- The hook automatically handles API URL construction based on the current chain ID.
- Data is fetched using React Query, providing caching and automatic refetching capabilities.
- The trust level for this data source is set to TRUST_LEVELS[TrustLevelEnum.TWO].
```
