# useDsProxyBuild

Hook for building a DS Proxy for a given account.

## Import

```ts
import { useDsProxyBuild } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useDsProxyBuild } from '@jetstreamgg/sky-hooks';

function App() {
  const { execute, isLoading, error, data } = useDsProxyBuild({
    onSuccess: txHash => console.log('Transaction successful:', txHash),
    onError: (err, txHash) => console.error('Transaction failed:', err, txHash),
    onStart: txHash => console.log('Transaction started:', txHash)
  });

  return (
    <div>
      <button onClick={execute} disabled={isLoading}>
        {isLoading ? 'Building...' : 'Build DS Proxy'}
      </button>
      {error && <p>Error: {error.message}</p>}
      {data && <p>Transaction Hash: {data}</p>}
    </div>
  );
}
```

## Parameters

```ts
import { type WriteHookParams } from '@jetstreamgg/sky-hooks';
```

### Props

```ts
type Props = WriteHookParams & {
  gas?: bigint;
};
```

- `onSuccess`: `(txHash: string) => void`
  - Callback function to be called when the transaction is successful.
- `onError`: `(error: Error, txHash?: string) => void`
  - Callback function to be called when the transaction fails.
- `onStart`: `(txHash: string) => void`
  - Callback function to be called when the transaction starts.
- `gas`: `bigint | undefined`
  - Optional gas limit for the transaction.

## Return Type

```ts
import { type WriteHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `string | undefined`
  - The transaction hash of the build transaction.
- `execute`: `() => void`
  - Function to execute the build transaction.
- `isLoading`: `boolean`
  - Whether the build transaction is currently loading.
- `error`: `any | undefined`
  - Any error that occurred during the build transaction.
- `prepareError`: `any | undefined`
  - Any error that occurred during the preparation of the build transaction.
- `prepared`: `boolean`
  - Whether the build transaction is prepared and ready to be executed.
- `retryPrepare`: `() => void`
  - Function to retry the preparation of the build transaction.
