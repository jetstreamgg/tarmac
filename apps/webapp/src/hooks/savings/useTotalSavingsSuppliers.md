## useTotalSavingsSuppliers

The hook returns an object with the following properties:

- `data`: The total number of unique suppliers (as a number).
- `isLoading`: A boolean indicating whether the data is currently being fetched.
- `error`: Any error that occurred during the data fetching process.
- `mutate`: A function to manually trigger a refetch of the data.
- `dataSources`: An array of objects containing information about the data sources used to fetch the data.

## Usage

```tsx
import { useTotalSavingsSuppliers } from '@jetstreamgg/sky-hooks';

function TotalSuppliersComponent() {
  const { data, isLoading, error } = useTotalSavingsSuppliers({
    subgraphUrl: 'https://custom-subgraph-url.com'
  });

  // ... rest of the component
}
```

## Parameters

```ts
type Props = {
  subgraphUrl?: string;
};
```

- `subgraphUrl`: `string | undefined`
  - Optional. A custom subgraph URL to use for fetching data. If not provided, the default URL will be used.
