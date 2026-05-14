# useDsProxyData

Hook for fetching DS Proxy data for a given owner address.

## Import

```ts
import { useDsProxyData } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useDsProxyData } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useDsProxyData('0x123...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Owner: {data?.owner}</p>
      <p>DS Proxy Address: {data?.dsProxyAddress}</p>
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
type Props = ReadHookParams<DsProxyHookData> & { owner?: `0x${string}` };
```

- `owner`: `0x${string} | undefined`
  - The owner address to fetch DS Proxy data for. Defaults to the connected address if not provided.
- `options`: `ReadHookParams<DsProxyHookData>`
  - Additional options for the query.

## Return Type

```ts
import { type DsProxyHookData } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `DsProxyHookData | undefined`
  - The fetched DS Proxy data.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
