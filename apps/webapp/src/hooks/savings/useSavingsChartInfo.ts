import { parseEther } from 'viem';
import { useChainId } from 'wagmi';
import { sUsdsAddress } from './useReadSavingsUsds';
import { ReadHook } from '../hooks';
import { useBaLabsHistoric } from '../shared/useBaLabsHistoric';

type SavingsChartInfo = {
  date: string;
  total_save: string;
};

type SavingsChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
};

function transformBaLabsChartData(results: SavingsChartInfo[]): SavingsChartInfoParsed[] {
  const parsed = results.map((item: SavingsChartInfo) => {
    const savingsTvl = Number(item.total_save).toFixed(18); //remove scientific notation if it exists
    return {
      blockTimestamp: new Date(item?.date).getTime() / 1000,
      amount: parseEther(savingsTvl)
    };
  });
  return parsed;
}

export function useSavingsChartInfo(
  paramChainId?: number,
  options: { limit?: number } = { limit: 100 }
): ReadHook & { data?: SavingsChartInfoParsed[] } {
  const { limit } = options;
  const wagmiChainId = useChainId();
  const chainId = paramChainId || wagmiChainId;
  const savingsAddress = sUsdsAddress[chainId as keyof typeof sUsdsAddress];

  return useBaLabsHistoric<SavingsChartInfo, SavingsChartInfoParsed>({
    path: '/overall/historic/',
    limit,
    queryKey: 'savings-chart',
    transform: transformBaLabsChartData,
    enabled: Boolean(savingsAddress)
  });
}
