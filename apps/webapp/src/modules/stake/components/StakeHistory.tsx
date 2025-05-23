import { useMemo } from 'react';
import {
  TransactionTypeEnum,
  useDelegateName,
  useRewardContractTokens,
  useStakeHistory
} from '@jetstreamgg/hooks';
import { formatBigInt, useFormatDates } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import {
  SavingsSupply,
  ArrowDown,
  Stake,
  Delegate,
  Borrow,
  ClaimRewards,
  Liquidated,
  Repaid,
  SelectRewards
} from '@/modules/icons';
import { HistoryTable } from '@/modules/ui/components/historyTable/HistoryTable';
import { Text } from '@/modules/layout/components/Typography';
import { StakeHistoryItem } from 'node_modules/@jetstreamgg/hooks/src/stake/stakeModule';
import { HighlightColor } from '@/modules/ui/components/historyTable/types';

const mapTypeEnumToColumn = (type: TransactionTypeEnum) => {
  switch (type) {
    case TransactionTypeEnum.STAKE_OPEN:
      return t`Open position`;
    case TransactionTypeEnum.STAKE:
      return t`Staked`;
    case TransactionTypeEnum.UNSTAKE:
      return t`Unstaked`;
    case TransactionTypeEnum.STAKE_REWARD:
      return t`Claim rewards`;
    case TransactionTypeEnum.STAKE_BORROW:
      return t`Borrowed`;
    case TransactionTypeEnum.STAKE_REPAY:
      return t`Repaid`;
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
      return t`Select delegate`;
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
      return t`Select reward`;
    case TransactionTypeEnum.UNSTAKE_KICK:
      return t`Liquidated`;
    default:
      return '';
  }
};

const mapTypeEnumToIcon = (type: TransactionTypeEnum) => {
  switch (type) {
    case TransactionTypeEnum.STAKE_OPEN:
      return <Stake width={20} height={20} className="-ml-1 mr-1" />;
    case TransactionTypeEnum.STAKE:
      return <SavingsSupply width={14} height={13} className="mr-1" />;
    case TransactionTypeEnum.STAKE_REWARD:
      return <ClaimRewards width={20} height={20} className="-ml-1 mr-1" />;
    case TransactionTypeEnum.STAKE_BORROW:
      return <Borrow width={20} height={20} className="-ml-1 mr-1" />;
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
      return <Delegate width={20} height={20} className="-ml-1 mr-1" />;
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
      return <SelectRewards width={20} height={20} className="-ml-1 mr-1" />;
    case TransactionTypeEnum.UNSTAKE:
      return <ArrowDown width={10} height={14} className="mr-1 fill-white" />;
    case TransactionTypeEnum.STAKE_REPAY:
      return <Repaid width={20} height={20} className="-ml-1 mr-1" />;
    case TransactionTypeEnum.UNSTAKE_KICK:
      return <Liquidated width={20} height={20} className="text-error -ml-1 mr-1" />;
    default:
      return <></>;
  }
};

// TODO: Eventually rewards will be claimed for different tokens as well,
// so we would need to fetch the reward token dynamically
const mapTypeEnumToTokenSymbol = (type: TransactionTypeEnum) => {
  switch (type) {
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.UNSTAKE:
      return 'SKY';
    case TransactionTypeEnum.STAKE_BORROW:
    case TransactionTypeEnum.STAKE_REPAY:
    case TransactionTypeEnum.STAKE_REWARD:
      return 'USDS';
    default:
      return '';
  }
};

const highlightedEvents = [TransactionTypeEnum.STAKE, TransactionTypeEnum.UNSTAKE_KICK];

const mapStakeRowToLeftText = (s: StakeHistoryItem) => {
  if ('amount' in s) {
    return `${formatBigInt(s.amount || 0n, { compact: true })} ${mapTypeEnumToTokenSymbol(s.type)}`;
  }
  if ('rewardContract' in s) {
    return <SelectRewardsText contractAddress={s.rewardContract as `0x${string}`} />;
  }
  if (s.type === TransactionTypeEnum.STAKE_OPEN) {
    return `Staking position ${s.urnIndex ? s.urnIndex + 1 : ''}`;
  }
  if (s.type === TransactionTypeEnum.STAKE_SELECT_DELEGATE && 'delegate' in s) {
    return <DelegateName delegate={s.delegate as `0x${string}`} />;
  }
  return '';
};

export function StakeHistory({ index }: { index?: number }) {
  const { data: stakeHistory, isLoading: stakeHistoryLoading, error } = useStakeHistory({ index });
  const { i18n } = useLingui();

  const memoizedDates = useMemo(() => stakeHistory?.map(s => s.blockTimestamp), [stakeHistory]);
  const formattedDates = useFormatDates(memoizedDates, i18n.locale, 'MMM d, yyyy, h:mm a');

  const history = stakeHistory?.map((s, index) => {
    return {
      id: `${s.transactionHash}-${s.type}`,
      type: mapTypeEnumToColumn(s.type),
      highlightText: highlightedEvents.includes(s.type),
      highlightColor:
        s.type === TransactionTypeEnum.UNSTAKE_KICK ? HighlightColor.Bearish : HighlightColor.Bullish,
      textLeft: mapStakeRowToLeftText(s),
      iconLeft: mapTypeEnumToIcon(s.type),
      formattedDate: formattedDates.length > index ? formattedDates[index] : '',
      rawDate: s.blockTimestamp,
      transactionHash: s.transactionHash
    };
  });

  return (
    <HistoryTable
      dataTestId="stake-history"
      history={history}
      error={error}
      isLoading={stakeHistoryLoading}
      transactionHeader={t`Value`}
      typeColumn
    />
  );
}

const SelectRewardsText = ({ contractAddress }: { contractAddress?: `0x${string}` }) => {
  const { data: rewardContractTokens } = useRewardContractTokens(contractAddress);

  if (!rewardContractTokens?.rewardsToken.symbol) {
    return <></>;
  }

  return <Text className="text-text">{rewardContractTokens?.rewardsToken.symbol}</Text>;
};

const DelegateName = ({ delegate }: { delegate?: `0x${string}` }) => {
  const { data: delegateName } = useDelegateName(delegate);

  if (!delegate) {
    return <Text className="text-text">No delegate</Text>;
  }

  return (
    <Text className="text-text">
      {delegateName !== 'Shadow delegate' ? delegateName : delegate.slice(0, 6) + '...' + delegate.slice(-4)}
    </Text>
  );
};
