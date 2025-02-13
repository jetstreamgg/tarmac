// import { RewardsHistory } from '@/components/historyTable/RewardsHistory';
// import { SavingsHistory } from '@/components/historyTable/SavingsHistory';
// import { UpgradeHistory } from '@/components/historyTable/UpgradeHistory';
// import { useAvailableTokenRewardContracts } from '@jetstreamgg/hooks';
// import { useChainId } from 'wagmi';
import { TradeHistory } from '@/components/historyTable/TradeHistory';

export const HistoryTesting = () => {
  // const chainId = useChainId();
  // const rewardContracts = useAvailableTokenRewardContracts(chainId);

  return (
    <div>
      <TradeHistory />
      {/* <UpgradeHistory /> */}
      {/* <SavingsHistory /> */}
      {/* {rewardContracts.map(rewardContract => {
          return (
            <div className="text-text" key={rewardContract.name}>
              <RewardsHistory rewardContract={rewardContract} />
            </div>
          );
        })} */}
    </div>
  );
};
