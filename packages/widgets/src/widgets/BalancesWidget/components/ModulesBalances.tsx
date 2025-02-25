import { RewardsBalanceCard } from './RewardsBalanceCard';
import { SavingsBalanceCard } from './SavingsBalanceCard';
import { SealBalanceCard } from './SealBalanceCard';

export interface CardProps {
  url?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  chainIds?: number[];
  loading?: boolean;
  error?: string;
  usdsSkySuppliedBalance?: bigint;
  usdsCleSuppliedBalance?: bigint;
  savingsBalances?: { chainId: number; balance: bigint }[];
  sealBalance?: bigint;
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
  usdsSkySuppliedBalance?: bigint;
  usdsCleSuppliedBalance?: bigint;
  hideSavings?: boolean;
  totalUserSealed?: bigint;
  savingsBalances?: { chainId: number; balance: bigint }[];
  savingsLoading?: boolean;
  sealBalance?: bigint;
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
  usdsSkySuppliedBalance,
  usdsCleSuppliedBalance,
  hideSavings,
  savingsBalances,
  savingsLoading
}: ModulesBalancesProps): React.ReactElement => {
  return (
    <div className="flex flex-col gap-2">
      {!hideModuleBalances && !hideRewards && (
        <RewardsBalanceCard
          url={rewardsCardUrl}
          onExternalLinkClicked={onExternalLinkClicked}
          loading={rewardsLoading}
          usdsSkySuppliedBalance={usdsSkySuppliedBalance}
          usdsCleSuppliedBalance={usdsCleSuppliedBalance}
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
