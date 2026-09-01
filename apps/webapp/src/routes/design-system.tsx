import { createFileRoute, notFound } from '@tanstack/react-router';
import { IS_PRODUCTION_ENV } from '@/lib/constants';
import DesignSystem from '@/pages/DesignSystem';

// Internal preview — available in dev and on preview/staging deployments,
// blocked only where VITE_ENV_NAME is explicitly 'production'.
export const Route = createFileRoute('/design-system')({
  beforeLoad: () => {
    if (IS_PRODUCTION_ENV) throw notFound();
  },
  component: DesignSystem
});
