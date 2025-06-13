# useAllRewardsUserHistory

Hook for fetching a user's history with all reward contract.

## Import

```ts
import { useAllRewardsUserHistory } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useAllRewardsUserHistory } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useAllRewardsUserHistory('0xUserAddress...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map(history => (
        <div key={history.timestamp}>
          <p>Reward contract: {history.rewardContractAddress}</p>
          <p>Action: {history.action}</p>
          <p>Amount: {history.amount}</p>
        </div>
      ))}
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
type Props = ReadHookParams<RewardUserHistory[]> & {
  userAddress: `0x${string}`;
  subgraphUrl?: string;
};
```

- `userAddress`: `0x${string}`
  - The address of the user to fetch history for.
- `options`: `ReadHookParams<RewardUserHistory[]>`
  - Additional options for the query.
- `subgraphUrl`: `string | undefined`
  - Optional. A custom subgraph URL to use for fetching data. If not provided, the default URL will be used.

## Return Type

```ts
import { type RewardUserHistory } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `RewardUserHistory[] | undefined`
  - The fetched user history.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
