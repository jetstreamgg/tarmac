import { createFileRoute } from '@tanstack/react-router';
import { ConvertIntent } from '@/lib/enums';

// Upgrade is mainnet-only; the L2 redirect lives in useAppOrchestration's
// route-validation effect where the connected chain is known.
export const Route = createFileRoute('/_shell/convert/upgrade')({
  staticData: { convertIntent: ConvertIntent.UPGRADE_INTENT }
});
