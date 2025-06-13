# useReadSavingsUsds

Hook for reading data from the Savings DAI contract using the proxy address and implementation ABI.

## Import

```ts
import { useReadSavingsUsds, sUsdsAddress, sUsdsImplementationAbi } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useReadSavingsUsds } from '@jetstreamgg/sky-hooks';

function SavingsDaiComponent() {
  const { data, error, isLoading, refetch } = useReadSavingsUsds({
    functionName: 'maxWithdraw',
    args: ['0xYourAddressHere']
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Max Withdraw: {data?.toString()}</p>
      <button onClick={() => refetch()}>Refresh Data</button>
    </div>
  );
}
```

## Parameters

```ts
import { type ReadContractParams } from 'wagmi';
```

### Props

```ts
type Props = ReadContractParams<typeof savingsdaiAbi, 'maxWithdraw'>;
```

- `functionName`: `string`
  - The name of the function to call on the Savings USDS contract.
- `args?`: `any[]`
  - The arguments to pass to the function call.
- `chainId?`: `number`
  - The chain ID to use for the contract call.
- `scopeKey?`: `string`
  - An optional key to scope the query.

## Return Type

```ts
import { type ReadHook } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `any | undefined`
  - The data returned from the contract call.
- `error`: `any | undefined`
  - Any error that occurred during the contract call.
- `isLoading`: `boolean`
  - Whether the contract call is currently loading.
- `refetch`: `() => void`
  - A function to manually refetch the data.
