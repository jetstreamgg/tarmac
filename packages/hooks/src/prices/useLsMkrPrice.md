# useLsMkrPrice

Hook for fetching the price of the Lockstake MKR token from the Sky Ecosystem contracts.

## Import

```ts
import { useLsMkrPrice } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useLsMkrPrice } from '@jetstreamgg/sky-hooks';

function lsMkrPriceComponent() {
  const { data, error, isLoading, mutate } = useLsMkrPrice();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data && (
        <div>
          <p>Price: {data.price}</p>
          <p>Symbol: {data.underlying_symbol}</p>
          <p>Source: {data.source}</p>
        </div>
      )}
      <button onClick={() => mutate()}>Refresh Price</button>
    </div>
  );
}
```

## Return Type

```ts
import { type PriceData } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `PriceData | undefined`
  - The fetched price data for the LOCKSTAKE MKR token.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the price data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
