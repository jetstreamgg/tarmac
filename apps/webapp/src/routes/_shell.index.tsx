import { createFileRoute } from '@tanstack/react-router';
import { BalancesPanes } from '@/modules/balances/components/BalancesPanes';
import { Intent } from '@/lib/enums';

export const Route = createFileRoute('/_shell/')({
  component: BalancesPanes,
  staticData: { intent: Intent.BALANCES_INTENT }
});
