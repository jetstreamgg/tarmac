# useRestrictedAddressCheck

Hook for checking if an address is allowed based on an authentication URL.

## Import

```ts
import { useRestrictedAddressCheck } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useRestrictedAddressCheck } from '@jetstreamgg/sky-hooks';

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
import { type ReadHookParams } from '@jetstreamgg/sky-hooks';
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
import { type AuthResponse } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `AuthResponse | undefined`
  - The response data from the authentication check.
- `error`: `any | undefined`
  - Any error that occurred during the check.
- `isLoading`: `boolean`
  - Whether the check is currently loading.
