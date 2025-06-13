# useRewardChartInfo

Hook for fetching chart information for a specific reward contract.

## Import

```ts
import { useRewardChartInfo } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useRewardChartInfo } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useRewardChartInfo('0xRewardContractAddress...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Chart Data: {JSON.stringify(data)}</p>
    </div>
  );
}
```

## Parameters

```ts
import { type ReadHookParams } from '@jetstreamgg/sky-hooks';
```

### Props

```ts
type Props = ReadHookParams<RewardChartInfo> & { rewardContractAddress: `0x${string}` };
```

- `rewardContractAddress`: `0x${string}`
  - The address of the reward contract to fetch chart information for.
- `options`: `ReadHookParams<RewardChartInfo>`
  - Additional options for the query.

## Return Type

```ts
import { type RewardChartInfo } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `RewardChartInfo | undefined`
  - The fetched chart information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
