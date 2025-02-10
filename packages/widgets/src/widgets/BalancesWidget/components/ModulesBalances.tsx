import { RewardsBalanceCard } from './RewardsBalanceCard';
import { SavingsBalanceCard } from './SavingsBalanceCard';
import { SealBalanceCard } from './SealBalanceCard';

export interface CardProps {
  url?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  chainIds?: number[];
}

interface ModulesBalancesProps {
  rewardsCardUrl?: string;
  savingsCardUrlMap?: Record<number, string>;
  sealCardUrl?: string;
  onExternalLinkClicked?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  hideModuleBalances?: boolean;
  chainIds?: number[];
}

export const ModulesBalances = ({
  rewardsCardUrl,
  savingsCardUrlMap,
  sealCardUrl,
  onExternalLinkClicked,
  hideModuleBalances,
  chainIds
}: ModulesBalancesProps): React.ReactElement => {
  return (
    <div className="flex flex-col gap-2">
      {!hideModuleBalances && (
        <RewardsBalanceCard url={rewardsCardUrl} onExternalLinkClicked={onExternalLinkClicked} />
      )}
      {!hideModuleBalances && (
        <SavingsBalanceCard
          urlMap={savingsCardUrlMap}
          onExternalLinkClicked={onExternalLinkClicked}
          chainIds={chainIds}
        />
      )}
      <SealBalanceCard url={sealCardUrl} onExternalLinkClicked={onExternalLinkClicked} />
    </div>
  );
};
