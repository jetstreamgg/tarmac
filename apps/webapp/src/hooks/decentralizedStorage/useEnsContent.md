# useEnsContent

Hook for fetching content from an ENS (Ethereum Name Service) subdomain. It returns the content as a string, along with the status of the fetching process.

## Import

```ts
import { useEnsContent } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useEnsContent } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useEnsContent({
    name: 'example.eth',
    subdomain: 'ipfs'
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data ? `Content: ${data}` : 'No content found'}</div>;
}
```

## Parameters

```ts
import { type ReadHookParams } from '@jetstreamgg/sky-hooks';
```

### Props

```ts
type Props = ReadHookParams<string> & {
  name: string;
  subdomain: 'ipfs' | 'test.ipfs';
  chainId?: number;
};
```

- `name`: `string`
  - The ENS name to fetch content from.
- `subdomain`: `'ipfs' | 'test.ipfs'`
  - The subdomain to fetch content from.
- `chainId`: `number | undefined`
  - The chain ID to use for the ENS resolver. Defaults to a specific chain ID.
- `options`: `ReadHookParams<string>`
  - Additional options for the query.

## Return Type

```ts
import { type ReadHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `string | undefined`
  - The fetched content.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
