# useSavingsWithdraw

Hook for handling the withdrawal of USDS tokens from the savings contract.

## Import

```ts
import { useSavingsWithdraw } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsWithdraw } from '@jetstreamgg/sky-hooks';

function WithdrawComponent() {
  const { execute, data, error, isLoading, mutate } = useSavingsWithdraw({
    amount: '1000000000000000000', // 1 USDS in wei
    max: false,
    onStart: hash => console.log(`Transaction started: ${hash}`),
    onSuccess: hash => console.log(`Transaction successful: ${hash}`),
    onError: (error, hash) => console.log(`Transaction failed: ${error.message}, hash: ${hash}`),
    enabled: true
  });

  return (
    <div>
      <button onClick={() => execute()} disabled={isLoading}>
        Withdraw
      </button>
      {error && <div>Error: {error.message}</div>}
      {data && <div>Transaction Hash: {data.hash}</div>}
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
type Props = ReadHookParams & {
  amount: string;
  max?: boolean;
  onStart?: (hash: string) => void;
  onSuccess?: (hash: string) => void;
  onError?: (error: Error, hash?: string) => void;
  enabled?: boolean;
};
```

- `amount`: `string`
  - The amount of USDS tokens to withdraw, in wei.
- `max?`: `boolean`
  - Whether to withdraw the maximum amount of USDS tokens.
- `onStart?`: `(hash: string) => void`
  - A callback function that is called when the transaction starts.
- `onSuccess?`: `(hash: string) => void`
  - A callback function that is called when the transaction is successful.
- `onError?`: `(error: Error, hash?: string) => void`
  - A callback function that is called when the transaction fails.
- `enabled?`: `boolean`
  - Whether the withdrawal is enabled.

## Return Type

```ts
import { type ReadHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `execute`: `() => void`
  - A function to execute the withdrawal.
- `data`: `any | undefined`
  - The data returned from the withdrawal transaction.
- `error`: `any | undefined`
  - Any error that occurred during the withdrawal.
- `isLoading`: `boolean`
  - Whether the withdrawal is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the data.
