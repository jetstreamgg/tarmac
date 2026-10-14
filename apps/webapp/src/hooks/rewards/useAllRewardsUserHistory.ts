import { ReadHook } from '../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { historyQueryArgs, secondsToDate } from '../shared/historyQueryHelpers';
import { PaginatedHistory } from '../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../shared/useIndexerFamilyHistory';
import { RewardUserHistoryItem, AllRewardsUserHistoryResponse, RewardContract } from './rewards';
import { useAvailableTokenRewardContracts } from './useAvailableTokenRewardContracts';
import { useChainId } from 'wagmi';
import { familyMainnetId } from '@/utils';

export function rewardsHistoryFragments({
  user,
  rewardContracts,
  chainId,
  beforeTimestamp
}: {
  user: string;
  rewardContracts: RewardContract[];
  chainId: number;
  beforeTimestamp?: number;
}): string {
  const rewardContractAddresses = rewardContracts.map(f => `"${chainId}-${f.contractAddress.toLowerCase()}"`);
  // historyQueryArgs wraps in parens for a top-level entity; nested lists take the same args.
  const userArgs = historyQueryArgs(`user: { _eq: "${user}" }`, beforeTimestamp);

  return `
      rewards: Reward(where: { id: { _in: [${rewardContractAddresses}] }, chainId: { _eq: ${chainId} } }) {
        address
        supplyInstances${userArgs} {
          blockTimestamp
          transactionHash
          amount
        }
        withdrawals${userArgs} {
          blockTimestamp
          transactionHash
          amount
        }
        rewardClaims${userArgs} {
          blockTimestamp
          transactionHash
          amount
        }
      }
  `;
}

export function mapRewardsHistoryResponse(
  response: AllRewardsUserHistoryResponse,
  chainId: number
): RewardUserHistoryItem[] | undefined {
  const rewardsData = response.rewards;

  if (!rewardsData) {
    return undefined;
  }

  const allRewardsHistoryItems = rewardsData.map(f => {
    const supplyInstances = f.supplyInstances.map(e => ({
      blockTimestamp: secondsToDate(e.blockTimestamp),
      transactionHash: e.transactionHash,
      amount: BigInt(e.amount),
      rewardsClaim: false,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.SUPPLY,
      rewardContractAddress: f.address,
      chainId
    }));
    const withdrawals = f.withdrawals.map(e => ({
      blockTimestamp: secondsToDate(e.blockTimestamp),
      transactionHash: e.transactionHash,
      amount: BigInt(-e.amount), //negative for withdrawals
      rewardsClaim: false,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.WITHDRAW,
      rewardContractAddress: f.address,
      chainId
    }));
    const rewardClaims = f.rewardClaims.map(e => ({
      blockTimestamp: secondsToDate(e.blockTimestamp),
      transactionHash: e.transactionHash,
      amount: BigInt(e.amount),
      rewardsClaim: true,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.REWARD,
      rewardContractAddress: f.address,
      chainId
    }));

    const allParsed = [...supplyInstances, ...withdrawals, ...rewardClaims];
    const sorted = allParsed.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

    return sorted;
  });

  return allRewardsHistoryItems.flat();
}

export function useAllRewardsUserHistory({
  indexerUrl
}: {
  indexerUrl?: string;
} = {}): ReadHook & PaginatedHistory & { data?: RewardUserHistoryItem[] } {
  //this hook is only used for mainnet, update this if this ever changes
  const chainIdToUse = familyMainnetId(useChainId());
  const rewardContracts = useAvailableTokenRewardContracts(chainIdToUse);

  return useIndexerFamilyHistory<RewardUserHistoryItem>({
    indexerUrl,
    familyMainnet: true,
    requireAddress: true,
    queryKey: ({ urlIndexer, address, chainId }) => [
      'all-rewards-user-history',
      urlIndexer,
      address,
      chainId
    ],
    fragments: ({ owner, chainId, beforeTimestamp }) =>
      rewardsHistoryFragments({ user: owner, rewardContracts, chainId, beforeTimestamp }),
    mapPage: (response: AllRewardsUserHistoryResponse, chainId) =>
      mapRewardsHistoryResponse(response, chainId) ?? [],
    // The mapper interleaves per-contract lists unsorted; sort so concatenated
    // pages stay globally ordered.
    sortDesc: true
  });
}
