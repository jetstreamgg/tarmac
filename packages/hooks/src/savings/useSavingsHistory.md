# useSavingsHistory

Hook for fetching the savings history of supplies and withdrawals from the Sky Ecosystem subgraph.
Fetches either the Ethereum or Base savings history, depending on wagmi's chainId.

## Import

```ts
import { useSavingsHistory } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useSavingsHistory } from '@jetstreamgg/sky-hooks';

function SavingsHistoryComponent() {
  const { data, error, isLoading, mutate } = useSavingsHistory({
    subgraphUrl: 'https://custom-subgraph-url.com'
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data &&
        data.map((entry, index) => (
          <div key={index}>
            <p>Type: {entry.type}</p>
            <p>Assets: {entry.assets.toString()}</p>
            <p>Timestamp: {entry.blockTimestamp.toString()}</p>
            <p>Transaction Hash: {entry.transactionHash}</p>
          </div>
        ))}
      <button onClick={() => mutate()}>Refresh History</button>
    </div>
  );
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

## Return Type

```ts
import { type SavingsHistory } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `SavingsHistory | undefined`
  - The fetched savings history data, including supplies and withdrawals.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
- `mutate`: `() => void`
  - A function to manually refetch the data.
- `dataSources`: `Array<{ title: string; href: string; onChain: boolean; trustLevel: number }>`
  - An array of data source objects, each containing information about the data source.
