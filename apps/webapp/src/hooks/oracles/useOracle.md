# useOracle

Hook for fetching data from a specific oracle.

## Import

```ts
import { useOracle } from '@/hooks';
```

## Usage

```tsx
import { useOracle } from '@/hooks';

function App() {
  const { data, error, isLoading } = useOracle('0xOracleAddress...');

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Oracle Data: {JSON.stringify(data)}</p>
    </div>
  );
}
```

## Parameters

```ts
import { type ReadHookParams } from '@/hooks';
```

### Props

```ts
type Props = ReadHookParams<OracleData> & { oracleAddress: `0x${string}` };
```

- `oracleAddress`: `0x${string}`
  - The address of the oracle to fetch data from.
- `options`: `ReadHookParams<OracleData>`
  - Additional options for the query.

## Return Type

```ts
import { type OracleData } from '@/hooks';
```

Returns an object containing:

- `data`: `OracleData | undefined`
  - The fetched oracle data.
- `error`: `any | undefined`
  - Any error that occurred during the fetch.
- `isLoading`: `boolean`
  - Whether the fetch is currently loading.
