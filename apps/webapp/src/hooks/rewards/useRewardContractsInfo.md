# useRewardContractsInfo

Hook for fetching information about multiple reward contracts.

## Import

```ts
import { useRewardContractsInfo } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useRewardContractsInfo } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useRewardContractsInfo([
    '0xRewardContractAddress1...',
    '0xRewardContractAddress2...'
  ]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map(rewardContract => (
        <div key={rewardContract.contractAddress}>
          <p>Name: {rewardContract.name}</p>
          <p>Description: {rewardContract.description}</p>
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
type Props = ReadHookParams<RewardContract[]> & {
  rewardContractAddresses: `0x${string}`[];
  subgraphUrl?: string;
};
```

- `rewardContractAddresses`: `0x${string}[]`
  - The addresses of the reward contracts to fetch information for.
- `options`: `ReadHookParams<RewardContract[]>`
  - Additional options for the query.
- `subgraphUrl`: `string | undefined`
  - Optional. A custom subgraph URL to use for fetching data. If not provided, the default URL will be used.

## Return Type

```ts
import { type RewardContract } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `RewardContract[] | undefined`
  - The fetched reward contracts information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
