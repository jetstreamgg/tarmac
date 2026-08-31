import { createFileRoute, redirect } from '@tanstack/react-router';
import { keepSearch } from '@/lib/navigation';

// CoW trading is parked pending E3 (async-order migration); the surface is
// intentionally unreachable until the product decision on restoring it lands.
export const Route = createFileRoute('/_shell/convert/trade')({
  beforeLoad: () => {
    throw redirect({ to: '/convert', search: keepSearch, replace: true });
  }
});
