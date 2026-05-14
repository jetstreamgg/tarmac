# useUserRewardsBalance

Hook for fetching rewards data for a specific reward contract from the BA Labs API.

## Import

```ts
import { useUserRewardsBalance } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useUserRewardsBalance } from '@jetstreamgg/sky-hooks';

function RewardsDataComponent() {
  const { data, error, isLoading, mutate } = useUserRewardsBalance();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data &&
        <div>
          <p>Balance: {data.balance}</p>
          <p>Reward Balance: {data.rewardBalance}</p>
        </div>
      <button onClick={() => mutate()}>Refresh Data</button>
    </div>
  );
}
```

## Return Type

```ts
import { type RewardsData } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `RewardsData | undefined`
  - The fetched and transformed rewards data.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
