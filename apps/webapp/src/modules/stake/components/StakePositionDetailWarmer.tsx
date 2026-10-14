import { useStakePositionDetail } from '../hooks/useStakePositionDetail';

/**
 * Mounts the position-details reads for one urn without rendering anything,
 * so the modal opens on warm caches (same hook, same query keys — nothing to
 * keep in sync). The table warms the first rows on load and the rest on intent.
 */
export function StakePositionDetailWarmer({ urnIndex }: { urnIndex: number }) {
  useStakePositionDetail(urnIndex);
  return null;
}
