import { createFileRoute } from '@tanstack/react-router';
import { SealEngine } from '@/pages/SealEngine';

export const Route = createFileRoute('/seal-engine')({
  component: SealEngine
});
