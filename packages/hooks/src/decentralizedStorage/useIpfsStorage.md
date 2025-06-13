# useIpfsStorage

Hook for fetching a file from decentralized storage (IPFS). It returns the file as text or a blob, along with the status of the file fetching process.

## Import

```ts
import { useIpfsStorage } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useIpfsStorage } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useIpfsStorage('QmHash...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data ? 'File fetched successfully' : 'No data'}</div>;
}
```

## Parameters

```ts
import { type ReadHookParams } from '@jetstreamgg/sky-hooks';
```

### Props

```ts
type Props = ReadHookParams<string | Blob> & { fileHash: string };
```

- `fileHash`: `string`
  - The hash of the file to fetch from IPFS.
- `options`: `ReadHookParams<string | Blob>`
  - Additional options for the query.

## Return Type

```ts
import { type ReadHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `string | Blob | undefined`
  - The fetched file data.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
