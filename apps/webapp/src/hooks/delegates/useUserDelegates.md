# useUserDelegates

Hook for fetching user-specific delegate information based on various parameters.

## Import

```ts
import { useUserDelegates } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useUserDelegates } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useUserDelegates({
    chainId: 1,
    user: '0x123...',
    search: 'delegateName',
    subgraphUrl: 'https://custom-subgraph-url.com'
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map(delegate => (
        <div key={delegate.id}>
          <p>Name: {delegate.name}</p>
          <p>Address: {delegate.address}</p>
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
type Props = ReadHookParams<DelegateInfo[]> & {
  chainId: number;
  user: `0x${string}`;
  search?: string;
  subgraphUrl?: string;
};
```

- `chainId`: `number`
  - The chain ID to fetch delegates from.
- `user`: `0x${string}`
  - The user address to fetch delegates for.
- `search`: `string | undefined`
  - A search term to filter delegates by name.
- `subgraphUrl`: `string | undefined`
  - Optional. A custom subgraph URL to use for fetching data. If not provided, the default URL for the given chainId will be used.
- `options`: `ReadHookParams<DelegateInfo[]>`
  - Additional options for the query.

## Return Type

```ts
import { type DelegateInfo } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `DelegateInfo[] | undefined`
  - The response data containing delegate information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
