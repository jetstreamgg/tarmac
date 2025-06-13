# useSavingsApprove

Hook for approving the USDS token for the savings contract.

## Import

```ts
import { useSavingsApprove } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsApprove } from '@jetstreamgg/sky-hooks';

function ApproveComponent() {
  const { execute, isLoading, error } = useSavingsApprove({
    amount: BigInt('1000000000000000000'), // 1 USDS in wei
    onStart: hash => console.log(`Transaction started: ${hash}`),
    onSuccess: hash => console.log(`Transaction successful: ${hash}`),
    onError: (error, hash) => console.log(`Transaction failed: ${error.message}, hash: ${hash}`)
  });

  return (
    <div>
      <button onClick={() => execute()} disabled={isLoading}>
        Approve
      </button>
      {error && <div>Error: {error.message}</div>}
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
  - The amount of USDS tokens to approve, in wei.
- `gas?`: `bigint`
  - Optional gas limit for the transaction.
- `onStart?`: `(hash: string) => void`
  - A callback function that is called when the transaction starts.
- `onSuccess?`: `(hash: string) => void`
  - A callback function that is called when the transaction is successful.
- `onError?`: `(error: Error, hash?: string) => void`
  - A callback function that is called when the transaction fails.

## Return Type

```ts
import { type WriteHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `execute`: `() => void`
  - A function to execute the approval.
- `isLoading`: `boolean`
  - Whether the approval is currently loading.
- `error`: `any | undefined`
  - Any error that occurred during the approval.
