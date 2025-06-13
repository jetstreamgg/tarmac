import { useMemo } from 'react';
import { RewardContract, useRewardsUserHistory, TransactionTypeEnum } from '@jetstreamgg/sky-hooks';
import { formatBigInt, useFormatDates } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { absBigInt } from '../../utils/math';
import { Supply, Withdraw, Reward } from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { useSubgraphUrl } from '@/modules/app/hooks/useSubgraphUrl';

export function RewardsHistory({ rewardContract }: { rewardContract: RewardContract }) {
  const subgraphUrl = useSubgraphUrl();
  const {
    data: allRewardContractsHistory,
    isLoading: rewardContractHistoryLoading,
    error
  } = useRewardsUserHistory({ rewardContractAddress: rewardContract.contractAddress, subgraphUrl });
  const rewardContractHistory = allRewardContractsHistory; //TODO: filter this by the reward contract
  const { i18n } = useLingui();

  const memoizedDates = useMemo(
    () => rewardContractHistory?.map(s => s.blockTimestamp),
    [rewardContractHistory]
  );
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  // map reward contract history to rows
  const history = rewardContractHistory?.map((f, index) => ({
    id: f.transactionHash,
    type:
      f.type === TransactionTypeEnum.REWARD
        ? t`Claim rewards`
        : f.type === TransactionTypeEnum.SUPPLY
          ? t`Supply`
          : t`Withdraw`,
    highlightText: f.type === TransactionTypeEnum.SUPPLY,
    textLeft: `${formatBigInt(absBigInt(f.amount), { compact: true })} ${f.type === TransactionTypeEnum.REWARD ? rewardContract.rewardToken.symbol : rewardContract.supplyToken.symbol}`,
    iconLeft:
      f.type === TransactionTypeEnum.REWARD ? (
        <Reward width={14} height={14} className="mr-1" />
      ) : f.type === TransactionTypeEnum.SUPPLY ? (
        <Supply width={14} height={14} className="text-bullish mr-1" />
      ) : (
        <Withdraw width={14} height={14} className="mr-1" />
      ),
    formattedDate: formattedDates.length > index ? formattedDates[index] : '',
    rawDate: f.blockTimestamp,
    transactionHash: f.transactionHash
  }));

  return (
    <HistoryTable
      history={history}
      error={error}
      isLoading={rewardContractHistoryLoading}
      transactionHeader={t`Amount`}
      typeColumn
    />
  );
}
