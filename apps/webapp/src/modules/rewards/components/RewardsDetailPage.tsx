import { useRouteRewardContract } from '../hooks/useRouteRewardContract';
import { RewardsProductDetail } from './RewardsProductDetail';

/**
 * Route-level wrapper for `/earn/rewards/$rewardContract`: resolves the path
 * param against the contracts available on the URL's chain and mounts the
 * template consumer. Unknown contracts are redirected away by
 * useAppOrchestration's route-validation effect (chain-dependent, so it lives
 * there, not in the route file) — render nothing while that resolves.
 */
export function RewardsDetailPage() {
  const contract = useRouteRewardContract();
  if (!contract) return null;
  return <RewardsProductDetail contract={contract} />;
}
