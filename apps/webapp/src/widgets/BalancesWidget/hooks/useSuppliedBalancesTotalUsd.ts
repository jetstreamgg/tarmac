import { useChainId, useConnection } from 'wagmi';
import {
  TOKENS,
  useAvailableTokenRewardContracts,
  useRewardsSuppliedBalance,
  useTotalUserStaked,
  useStUsdsData,
  useAllMorphoVaultsUserAssets,
  useAllPendleUserAssets,
  useMultiChainSavingsBalances,
  usePrices
} from '@/hooks';
import { chainId as chainIdConstants, isTestnetId } from '@/utils';

const bigintToUsd = (balance: bigint, priceStr: string) => (Number(balance) / 1e18) * parseFloat(priceStr);

/**
 * All-networks USD total of the user's supplied funds. Mirrors ModulesBalances'
 * per-module valuation (errored reads count as 0, like its hide logic); the
 * underlying queries are shared, so mounting both costs no extra requests.
 * Superseded by the Earn marketplace aggregator when C1 lands.
 */
export function useSuppliedBalancesTotalUsd({ chainIds }: { chainIds?: number[] } = {}) {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const mainnetChainId = isTestnetId(currentChainId) ? chainIdConstants.tenderly : chainIdConstants.mainnet;
  const rewardContracts = useAvailableTokenRewardContracts(mainnetChainId);

  const findContract = (rewardSymbol: string) =>
    rewardContracts.find(
      f => f.supplyToken.symbol === TOKENS.usds.symbol && f.rewardToken.symbol === rewardSymbol
    );

  const { data: usdsSkySupplied, isLoading: usdsSkyLoading } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: findContract(TOKENS.sky.symbol)?.contractAddress as `0x${string}`
  });
  const { data: usdsCleSupplied, isLoading: usdsCleLoading } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: findContract(TOKENS.cle.symbol)?.contractAddress as `0x${string}`
  });
  const { data: usdsSpkSupplied, isLoading: usdsSpkLoading } = useRewardsSuppliedBalance({
    chainId: mainnetChainId,
    address,
    contractAddress: findContract(TOKENS.spk.symbol)?.contractAddress as `0x${string}`
  });
  const { data: totalUserStaked, isLoading: stakeLoading } = useTotalUserStaked();
  const { data: stUsdsData, isLoading: stUsdsLoading } = useStUsdsData();
  const { data: morphoAssets, isLoading: morphoLoading } = useAllMorphoVaultsUserAssets();
  const { data: pendleAssets, isLoading: pendleLoading } = useAllPendleUserAssets();
  const { data: savingsBalances, isLoading: savingsLoading } = useMultiChainSavingsBalances({ chainIds });
  const { data: pricesData, isLoading: pricesLoading } = usePrices();

  const isLoading =
    usdsSkyLoading ||
    usdsCleLoading ||
    usdsSpkLoading ||
    stakeLoading ||
    stUsdsLoading ||
    morphoLoading ||
    pendleLoading ||
    savingsLoading ||
    pricesLoading;

  if (isLoading || !pricesData) {
    return { totalUsd: undefined, isLoading: true };
  }

  const totalRewardsSupplied = (usdsSkySupplied ?? 0n) + (usdsCleSupplied ?? 0n) + (usdsSpkSupplied ?? 0n);
  const totalSavings = Object.values(savingsBalances ?? {}).reduce((acc, balance) => acc + balance, 0n);

  const usdsPrice = pricesData.USDS?.price ?? '0';
  const skyPrice = pricesData.SKY?.price ?? '0';

  const totalUsd =
    bigintToUsd(totalRewardsSupplied, usdsPrice) +
    bigintToUsd(totalSavings, usdsPrice) +
    bigintToUsd(totalUserStaked ?? 0n, skyPrice) +
    bigintToUsd(morphoAssets.total, usdsPrice) +
    pendleAssets.totalUsd +
    bigintToUsd(stUsdsData?.userSuppliedUsds ?? 0n, usdsPrice);

  return { totalUsd, isLoading: false };
}
