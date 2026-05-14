# useSavingsSupply

Hook for supplying an amount into the savings contract.

## Import

```ts
import { useSavingsSupply } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsSupply } from '@jetstreamgg/sky-hooks';

function App() {
  const { execute, isLoading, error, data } = useSavingsSupply({
    amount: 1000n,
    onSuccess: txHash => console.log('Transaction successful:', txHash),
    onError: (err, txHash) => console.error('Transaction failed:', err, txHash),
    onStart: txHash => console.log('Transaction started:', txHash)
  });

  return (
    <div>
      <button onClick={execute} disabled={isLoading}>
        {isLoading ? 'Supplying...' : 'Supply'}
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
  amount: bigint;
};
```

- `amount`: `bigint`
  - The amount to supply.
- `onSuccess`: `(txHash: string) => void`
  - Callback function to be called when the transaction is successful.
- `onError`: `(error: Error, txHash?: string) => void`
  - Callback function to be called when the transaction fails.
- `onStart`: `(txHash: string) => void`
  - Callback function to be called when the transaction starts.
- `gas`: `bigint | undefined`
  - Optional gas limit for the transaction.
- `enabled`: `boolean | undefined`
  - Whether the hook is enabled.

## Return Type

```ts
import { type WriteHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `string | undefined`
  - The transaction hash of the supply transaction.
- `execute`: `() => void`
  - Function to execute the supply transaction.
- `isLoading`: `boolean`
  - Whether the supply transaction is currently loading.
- `error`: `any | undefined`
  - Any error that occurred during the supply transaction.
- `prepareError`: `any | undefined`
  - Any error that occurred during the preparation of the supply transaction.
- `prepared`: `boolean`
  - Whether the supply transaction is prepared and ready to be executed.
- `retryPrepare`: `() => void`
  - Function to retry the preparation of the supply transaction.
