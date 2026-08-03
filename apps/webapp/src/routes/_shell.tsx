import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/modules/app/components/AppShell';

// Pathless layout: every module route renders the app shell; the active module
// and its entities are derived from the matched route (staticData + params),
// not from the route's own component.
export const Route = createFileRoute('/_shell')({
  component: AppShell
});
