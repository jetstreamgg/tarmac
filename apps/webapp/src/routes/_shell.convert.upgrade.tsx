import { createFileRoute, redirect } from '@tanstack/react-router';
import { keepSearch } from '@/lib/navigation';

// The Upgrade surface is parked (unreachable) pending the product decision on
// folding DAI→USDS / MKR→SKY onto the V2 convert surface vs retiring it.
export const Route = createFileRoute('/_shell/convert/upgrade')({
  beforeLoad: () => {
    throw redirect({ to: '/convert', search: keepSearch, replace: true });
  }
});
