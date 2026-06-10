import { createFileRoute } from '@tanstack/react-router';
import Home from '@/pages/Home';

// Pathless layout: every module route renders the app shell; the active module
// and its entities are derived from the matched route (staticData + params),
// not from the route's own component.
export const Route = createFileRoute('/_shell')({
  component: Home
});
