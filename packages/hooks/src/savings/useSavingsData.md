# useSavingsData

Hook for fetching data related to the USDS Savings Rate, including total value locked (TVL), savings rate, and user balances.

## Import

```ts
import { useSavingsData } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsData } from '@jetstreamgg/sky-hooks';

function SavingsDataComponent() {
  const { data, error, isLoading, mutate } = useSavingsData();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data && (
        <div>
          <p>Savings TVL: {data.savingsTvl.toString()}</p>
          <p>Savings Rate: {data.savingsRate.toString()}</p>
          <p>User Savings Balance: {data.userSavingsBalance.toString()}</p>
          <p>User USDS Balance: {data.userNstBalance.toString()}</p>
        </div>
      )}
      <button onClick={() => mutate()}>Refresh Data</button>
    </div>
  );
}
```

## Return Type

```ts
import { type SavingsHookData } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `SavingsHookData | undefined`
  - The fetched data related to the USDS Savings Rate.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
