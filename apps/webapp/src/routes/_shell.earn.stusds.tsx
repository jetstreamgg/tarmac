import { createFileRoute } from '@tanstack/react-router';
import { StUsdsProductDetail } from '@/modules/stusds/components/StUsdsProductDetail';
import { Intent } from '@/lib/enums';
import { requireModuleEnabled } from '@/modules/geo-config/routeGuard';

// stUSDS product detail (D7) — the Expert module's single product, flattened to
// a first-class earn path. Keeps EXPERT_INTENT for orchestration/network
// validation; renders full-width through the ProductDetailTemplate like the
// Savings/vault/fixed pages. Freely reachable: the expert-risk acknowledgement
// lives in the supply modal, not a route gate.
export const Route = createFileRoute('/_shell/earn/stusds')({
  beforeLoad: ({ location, search }) => requireModuleEnabled('expert', location.searchStr, search),
  component: StUsdsProductDetail,
  staticData: { intent: Intent.EXPERT_INTENT }
});
