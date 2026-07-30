# useRewardContractInfo

Hook for fetching information about a specific reward contract.

## Import

```ts
import { useRewardContractInfo } from '@/hooks';
```

## Usage

```tsx
import { useRewardContractInfo } from '@/hooks';

function App() {
  const { data, error, isLoading } = useRewardContractInfo({
    chainId: 1,
    rewardContractAddress: '0xRewardContractAddress...'
  });

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

### Props

```ts
type Props = {
  chainId: number;
  rewardContractAddress: `0x${string}`;
  indexerUrl?: string;
};
```

- `chainId`: `number`
  - The chain to fetch the reward contract information for.
- `rewardContractAddress`: `0x${string}`
  - The address of the reward contract to fetch information for.
- `indexerUrl`: `string | undefined`
  - Optional. A custom indexer URL to use for fetching data. If not provided, the default URL will be used.

## Return Type

```ts
import { type RewardContract } from '@/hooks';
```

Returns an object containing:

- `data`: `RewardContract | undefined`
  - The fetched reward contract information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
