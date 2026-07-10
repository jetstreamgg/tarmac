import { createFileRoute, notFound } from '@tanstack/react-router';
import DesignSystem from '@/pages/DesignSystem';

export const Route = createFileRoute('/design-system')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: DesignSystem
});
