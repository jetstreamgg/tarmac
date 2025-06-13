# useDelegates

Hook for fetching delegate information based on various parameters.

## Import

```ts
import { useDelegates } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useDelegates } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useDelegates({
    chainId: 1,
    page: 1,
    pageSize: 10,
    random: false,
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
  page?: number;
  pageSize?: number;
  random?: boolean;
  search?: string;
  subgraphUrl?: string;
};
```

- `chainId`: `number`
  - The chain ID to fetch delegates from.
- `page`: `number | undefined`
  - The page number for pagination. Defaults to 1.
- `pageSize`: `number | undefined`
  - The number of delegates per page. Defaults to 10.
- `random`: `boolean | undefined`
  - Whether to fetch delegates in random order. Defaults to false.
- `search`: `string | undefined`
  - A search term to filter delegates by name.
- `subgraphUrl`: `string | undefined`
  - Optional. A custom subgraph URL to use for fetching data. If not provided, the default URL for the given chainId will be used.

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
