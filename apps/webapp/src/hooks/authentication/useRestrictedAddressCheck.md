# useRestrictedAddressCheck

Hook for checking if an address is allowed based on an authentication URL.

Every call can reach the paid screening provider once the worker's 12h edge cache expires, so the hook never polls: a verdict stays fresh for `SCREENING_MAX_AGE_MS` (4h), and the webapp only enables it before showing the terms. The pre-transaction gate reads and writes the same cache entry (`addressScreeningQueryKey`).

## Import

```ts
import { useRestrictedAddressCheck } from '@/hooks';
```

## Usage

```tsx
import { useRestrictedAddressCheck } from '@/hooks';

function App() {
  const { data, error, isLoading } = useRestrictedAddressCheck({
    address: '0x123...',
    authUrl: 'https://auth.example.com',
    enabled: true
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data?.addressAllowed ? 'Address is allowed' : 'Address is not allowed'}</div>;
}
```

## Parameters

```ts
import { type ReadHookParams } from '@/hooks';
```

### Props

```ts
type Props = ReadHookParams<AuthResponse> & { address?: string; authUrl: string; enabled: boolean };
```

- `address`: `string | undefined`
  - The address to check.
- `authUrl`: `string`
  - The URL to use for authentication.
- `enabled`: `boolean`
  - Whether the check is enabled.
- `options`: `ReadHookParams<AuthResponse>`
  - Additional options for the query.

## Return Type

```ts
import { type AuthResponse } from '@/hooks';
```

Returns an object containing:

- `data`: `AuthResponse | undefined`
  - The response data from the authentication check.
- `error`: `any | undefined`
  - Any error that occurred during the check.
- `isLoading`: `boolean`
  - Whether the check is currently loading.
- `refetch`: `() => void`
  - Manually re-runs the check (used by the "check again" path on the screening-unavailable state).
