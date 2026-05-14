# useOracles

Hook for fetching data from multiple oracles.

## Import

```ts
import { useOracles } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useOracles } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useOracles(['0xOracleAddress1...', '0xOracleAddress2...']);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map((oracle, index) => (
        <div key={index}>
          <p>Oracle Data: {JSON.stringify(oracle)}</p>
        </div>
      ))}
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
type Props = ReadHookParams<OracleData[]> & { oracleAddresses: `0x${string}`[] };
```

- `oracleAddresses`: `0x${string}[]`
  - The addresses of the oracles to fetch data from.
- `options`: `ReadHookParams<OracleData[]>`
  - Additional options for the query.

## Return Type

```ts
import { type OracleData } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `OracleData[] | undefined`
  - The fetched oracle data.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
