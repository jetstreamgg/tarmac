import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { formatBaLabsUrl } from '../helpers';
import { useQuery } from '@tanstack/react-query';
import { baLabsDataSource } from '../constants';
import { ReadHook } from '../hooks';
import { toReadHook } from '../shared/toReadHook';
import { fetchJson } from '../shared/fetchJson';

type RewardsDataResponse = {
  wallet_address: string;
  balance: string;
  reward_balance: string;
  reward_tokens_per_second: string;
};

type RewardsData = {
  walletAddress: string;
  balance: string;
  rewardBalance: string;
  rewardTokensPerSecond: string;
};

async function fetchRewardsData(url: URL): Promise<RewardsData> {
  try {
    const data = await fetchJson<RewardsDataResponse>(url, { label: 'BaLabs data' });

    return {
      walletAddress: data?.wallet_address || '',
      balance: data?.balance || '',
      rewardBalance: data?.reward_balance || '',
      rewardTokensPerSecond: data?.reward_tokens_per_second || ''
    };
  } catch (error) {
    console.warn('Error fetching BaLabs data:', error);
    return {
      walletAddress: '',
      balance: '',
      rewardBalance: '',
      rewardTokensPerSecond: ''
    };
  }
}

export const useUserRewardsBalance = ({
  contractAddress,
  address
}: {
  contractAddress?: `0x${string}`;
  address: `0x${string}`;
}): ReadHook & { data?: RewardsData } => {
  const baseUrl = getBaLabsApiUrl() || '';
  let url: URL | undefined;
  if (baseUrl && contractAddress && address) {
    const endpoint = `${baseUrl}/farms/${contractAddress.toLowerCase()}/wallets/${address.toLowerCase()}`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const query = useQuery<RewardsData | undefined>({
    enabled: Boolean(baseUrl && contractAddress && address),
    queryKey: ['rewards-data', url],
    queryFn: () => (url ? fetchRewardsData(url) : Promise.resolve(undefined))
  });

  return toReadHook(query, [baLabsDataSource(url)]);
};
