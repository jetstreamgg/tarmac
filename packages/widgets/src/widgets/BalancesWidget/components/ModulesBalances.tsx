import { RewardsBalanceCard } from './RewardsBalanceCard';
import { SavingsBalanceCard } from './SavingsBalanceCard';
import { SealBalanceCard } from './SealBalanceCard';
import { StakeBalanceCard } from './StakeBalanceCard';

export interface CardProps {
  url?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  chainIds?: number[];
  loading?: boolean;
  error?: string;
  totalUserRewardsSupplied?: bigint;
  savingsBalances?: { chainId: number; balance: bigint }[];
  sealBalance?: bigint;
  stakeBalance?: bigint;
}

interface ModulesBalancesProps {
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  sealCardUrl?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  hideModuleBalances?: boolean;
  chainIds?: number[];
  hideRewards?: boolean;
  rewardsLoading?: boolean;
  hideSeal?: boolean;
  sealLoading?: boolean;
  totalUserRewardsSupplied?: bigint;
  hideSavings?: boolean;
  totalUserSealed?: bigint;
  savingsBalances?: { chainId: number; balance: bigint }[];
  savingsLoading?: boolean;
  sealBalance?: bigint;
  stakeBalance?: bigint;
  stakeLoading?: boolean;
  hideStake?: boolean;
  stakeCardUrl?: string;
}

export const ModulesBalances = ({
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  onExternalLinkClicked,
  hideModuleBalances,
  hideRewards,
  rewardsLoading,
  hideSeal,
  sealLoading,
  sealBalance,
  totalUserRewardsSupplied,
  hideSavings,
  savingsBalances,
  savingsLoading,
  stakeBalance,
  stakeLoading,
  hideStake,
  stakeCardUrl
}: ModulesBalancesProps): React.ReactElement => {
  return (
    <div className="flex flex-col gap-2">
      {!hideModuleBalances && !hideRewards && (
        <RewardsBalanceCard
          url={rewardsCardUrl}
          onExternalLinkClicked={onExternalLinkClicked}
          loading={rewardsLoading}
          totalUserRewardsSupplied={totalUserRewardsSupplied}
        />
      )}
      {!hideModuleBalances && !hideSavings && (
        <SavingsBalanceCard
          urlMap={savingsCardUrlMap ?? {}}
          onExternalLinkClicked={onExternalLinkClicked}
          loading={savingsLoading}
          savingsBalances={savingsBalances}
        />
      )}
      {!hideStake && (
        <StakeBalanceCard
          loading={stakeLoading}
          stakeBalance={stakeBalance}
          onExternalLinkClicked={onExternalLinkClicked}
          url={stakeCardUrl}
        />
      )}
      {!hideSeal && (
        <SealBalanceCard
          onExternalLinkClicked={onExternalLinkClicked}
          url={sealCardUrl}
          loading={sealLoading}
          sealBalance={sealBalance}
        />
      )}
    </div>
  );
};
