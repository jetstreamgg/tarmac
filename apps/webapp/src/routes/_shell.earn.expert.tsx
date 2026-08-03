import { createFileRoute, redirect } from '@tanstack/react-router';
import { keepSearch } from '@/lib/navigation';

// The Expert module collapsed into its single product at /earn/stusds (D7);
// the old overview URL (and its /stusds child) forwards there.
export const Route = createFileRoute('/_shell/earn/expert')({
  beforeLoad: () => {
    throw redirect({ to: '/earn/stusds', search: keepSearch, replace: true });
  }
});
