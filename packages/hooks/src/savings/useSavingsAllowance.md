# useSavingsAllowance

Hook for fetching the USDS token allowance for the savings contract.

## Import

```ts
import { useSavingsAllowance } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsAllowance } from '@jetstreamgg/sky-hooks';

function AllowanceComponent() {
  const { data, error, isLoading, mutate } = useSavingsAllowance();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Allowance: {data?.toString()}</p>
      <button onClick={() => mutate()}>Refresh Allowance</button>
    </div>
  );
}
```

## Return Type

```ts
import { type DSRAllowanceHookResponse } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `bigint | undefined`
  - The fetched USDS token allowance for the savings contract.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
