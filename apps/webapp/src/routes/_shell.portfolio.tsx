import { createFileRoute } from '@tanstack/react-router';
import { PortfolioPage } from '@/modules/portfolio/components/PortfolioPage';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/portfolio')({
  component: PortfolioPage,
  staticData: { intent: Intent.BALANCES_INTENT, fullWidth: true }
});
