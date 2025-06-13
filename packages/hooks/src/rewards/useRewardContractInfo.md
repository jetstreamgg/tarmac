# useRewardContractInfo

Hook for fetching information about a specific reward contract.

## Import

```ts
import { useRewardContractInfo } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useRewardContractInfo } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useRewardContractInfo('0xRewardContractAddress...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Name: {data?.name}</p>
      <p>Description: {data?.description}</p>
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
type Props = ReadHookParams<RewardContract> & {
  rewardContractAddress: `0x${string}`;
  subgraphUrl?: string;
};
```

- `rewardContractAddress`: `0x${string}`
  - The address of the reward contract to fetch information for.
- `options`: `ReadHookParams<RewardContract>`
  - Additional options for the query.
- `subgraphUrl`: `string | undefined`
  - Optional. A custom subgraph URL to use for fetching data. If not provided, the default URL will be used.

## Return Type

```ts
import { type RewardContract } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `RewardContract | undefined`
  - The fetched reward contract information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
