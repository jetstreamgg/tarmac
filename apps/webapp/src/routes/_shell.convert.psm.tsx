import { createFileRoute, redirect } from '@tanstack/react-router';
import { keepSearch } from '@/lib/navigation';

// The PSM 1:1 flow *is* the /convert page now (E2); the old sub-route forwards
// there, keeping `source_token` so legacy deep links preselect the direction.
export const Route = createFileRoute('/_shell/convert/psm')({
  beforeLoad: () => {
    throw redirect({ to: '/convert', search: keepSearch, replace: true });
  }
});
