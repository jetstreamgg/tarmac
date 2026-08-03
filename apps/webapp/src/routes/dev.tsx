import { createFileRoute, notFound } from '@tanstack/react-router';
import Dev from '@/pages/Dev';

export const Route = createFileRoute('/dev')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Dev
});
