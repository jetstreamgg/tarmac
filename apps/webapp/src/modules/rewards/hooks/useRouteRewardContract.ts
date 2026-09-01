import { useChainId, useChains } from 'wagmi';
import { RewardContract, useAvailableTokenRewardContracts } from '@/hooks';
import { Intent } from '@/lib/enums';
import { QueryParams } from '@/lib/constants';
import { useAppSearchParams, useRouteEntityParams, useRouteIntent } from '@/lib/navigation';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';

/**
 * Reward contract selected by the current route (`/rewards/$rewardContract`),
 * resolved against the contracts available on the chain the URL points at —
 * the network param wins over the connected chain, mirroring the route
 * validation in useAppOrchestration. Undefined outside the rewards detail
 * route or for contracts unknown on the target chain.
 */
export function useRouteRewardContract(): RewardContract | undefined {
  const intent = useRouteIntent();
  const { rewardContract } = useRouteEntityParams();
  const chainId = useChainId();
  const chains = useChains();
  const [searchParams] = useAppSearchParams();

  const network = searchParams.get(QueryParams.Network) || undefined;
  const newChainId = network
    ? (chains.find(chain => normalizeUrlParam(chain.name) === normalizeUrlParam(network))?.id ?? chainId)
    : chainId;

  const rewardContracts = useAvailableTokenRewardContracts(newChainId);

  return intent === Intent.REWARDS_INTENT && rewardContract
    ? rewardContracts?.find(c => c.contractAddress?.toLowerCase() === rewardContract.toLowerCase())
    : undefined;
}
