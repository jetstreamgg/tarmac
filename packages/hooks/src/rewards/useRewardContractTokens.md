# useRewardContractTokens

Hook for fetching tokens associated with a specific reward contract.

## Import

```ts
import { useRewardContractTokens } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useRewardContractTokens } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useRewardContractTokens('0xRewardContractAddress...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map(token => (
        <div key={token.address}>
          <p>Token Name: {token.name}</p>
          <p>Token Symbol: {token.symbol}</p>
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
type Props = ReadHookParams<Token[]> & { rewardContractAddress: `0x${string}` };
```

- `rewardContractAddress`: `0x${string}`
  - The address of the reward contract to fetch tokens for.
- `options`: `ReadHookParams<Token[]>`
  - Additional options for the query.

## Return Type

```ts
import { type Token } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `Token[] | undefined`
  - The fetched tokens.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
