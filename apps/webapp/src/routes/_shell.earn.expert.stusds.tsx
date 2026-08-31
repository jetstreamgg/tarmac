import { createFileRoute } from '@tanstack/react-router';

// Old stUSDS detail URL under the retired Expert module — the parent
// /earn/expert route's beforeLoad forwards both to /earn/stusds (D7).
export const Route = createFileRoute('/_shell/earn/expert/stusds')({});
