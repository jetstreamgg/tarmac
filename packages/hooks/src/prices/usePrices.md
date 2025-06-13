# usePrices

Hook for fetching token price data from the BA Labs API.

## Import

```ts
import { usePrices } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { usePrices } from '@jetstreamgg/sky-hooks';

function PriceComponent() {
  const { data, error, isLoading } = usePrices();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data &&
        Object.entries(data).map(([symbol, priceData]) => (
          <div key={symbol}>
            <p>
              {symbol}: {priceData.price}
            </p>
          </div>
        ))}
      <button onClick={() => mutate()}>Refresh Prices</button>
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
type Props = ReadHookParams<Record<string, PriceData>>;
```

- `options`: `ReadHookParams<Record<string, PriceData>>`
  - Additional options for the query.

## Return Type

```ts
import { type PriceData } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `Record<string, PriceData> | undefined`
  - The fetched price data, indexed by token symbol.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the price data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
