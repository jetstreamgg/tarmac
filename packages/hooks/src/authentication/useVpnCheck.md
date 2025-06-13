# useVpnCheck

Hook for checking if a user is connected to a VPN and if they are in a restricted region based on an authentication URL.

## Import

```ts
import { useVpnCheck } from '@jetstreamgg/sky-hooks';
```

## Usage

```tsx
import { useVpnCheck } from '@jetstreamgg/sky-hooks';

function App() {
  const { data, error, isLoading } = useVpnCheck({
    authUrl: 'https://auth.example.com',
    enabled: true
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.isConnectedToVpn ? 'Connected to VPN' : 'Not connected to VPN'}
      {data?.isRestrictedRegion ? 'In a restricted region' : 'Not in a restricted region'}
      <div>Country Code: {data?.countryCode}</div>
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
type Props = ReadHookParams<VpnResponse> & { authUrl: string };
```

- `authUrl`: `string`
  - The URL to use for authentication.
- `refetchInterval`: `number`
  - Interval in milliseconds to refetch the VPN status. Defaults to 60000 (60 seconds).
- `options`: `ReadHookParams<VpnResponse>`
  - Additional options for the query.

## Return Type

```ts
import { type VpnResponse } from '@jetstreamgg/sky-hooks';
```

Returns an object containing:

- `data`: `VpnResponse | undefined`
  - The response data from the VPN check.
- `error`: `any | undefined`
  - Any error that occurred during the check.
- `isLoading`: `boolean`
  - Whether the check is currently loading.
