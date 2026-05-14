# useSavingsChartInfo

Hook for fetching and transforming the savings chart information from the BA Labs API.

## Import

```ts
import { useSavingsChartInfo } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsChartInfo } from '@jetstreamgg/sky-hooks';

function SavingsChartComponent() {
  const { data, error, isLoading, mutate } = useSavingsChartInfo();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data &&
        data.map((entry, index) => (
          <div key={index}>
            <p>Timestamp: {new Date(entry.blockTimestamp * 1000).toLocaleString()}</p>
            <p>Amount: {entry.amount.toString()}</p>
          </div>
        ))}
      <button onClick={() => mutate()}>Refresh Chart</button>
    </div>
  );
}
```

## Return Type

```ts
import { type SavingsChartInfoParsed } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `SavingsChartInfoParsed[] | undefined`
  - The fetched and transformed savings chart information.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
