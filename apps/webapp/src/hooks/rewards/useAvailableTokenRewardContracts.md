# useAvailableTokenRewardContracts

Hook for fetching available token reward contracts.

## Import

```ts
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useAvailableTokenRewardContracts } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useAvailableTokenRewardContracts();

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
type Props = ReadHookParams<RewardContract[]>;
```

- `options`: `ReadHookParams<RewardContract[]>`
  - Additional options for the query.

## Return Type

```ts
import { type RewardContract } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `RewardContract[] | undefined`
  - The fetched rewardContracts.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
