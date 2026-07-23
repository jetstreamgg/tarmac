# useRewardContractsInfo

Hook for fetching information about multiple reward contracts.

## Import

```ts
import { useRewardContractsInfo } from '@/hooks';
```

## Usage

```tsx
import { useRewardContractsInfo } from '@/hooks';

function App() {
  const { data, error, isLoading } = useRewardContractsInfo({
    chainId: 1,
    rewardContracts // RewardContract[] for the chain, e.g. from getAvailableTokenRewardContracts
  });

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

### Props

```ts
type Props = {
  chainId: number;
  rewardContracts: RewardContract[];
  indexerUrl?: string;
};
```

- `chainId`: `number`
  - The chain to fetch the reward contract information for.
- `rewardContracts`: `RewardContract[]`
  - The reward contracts to fetch information for.
- `indexerUrl`: `string | undefined`
  - Optional. A custom indexer URL to use for fetching data. If not provided, the default URL will be used.

## Return Type

```ts
import { type RewardContract } from '@/hooks';
```

Returns an object containing:

- `data`: `RewardContract[] | undefined`
  - The fetched reward contracts information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
