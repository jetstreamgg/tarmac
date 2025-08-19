import { CombinedHistoryItem, TransactionTypeEnum } from '@jetstreamgg/sky-hooks';
import { getAmount } from './getAmount';
import { getToken } from './getToken';
import { formatAddress } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';

export const getHistoryRightText = ({
  item,
  type,
  tradeFromToken,
  savingsToken,
  rewardToken,
  chainId
}: {
  item: CombinedHistoryItem;
  type: TransactionTypeEnum;
  tradeFromToken?: string;
  savingsToken?: string;
  rewardToken?: string;
  chainId: number;
}) => {
  if ([TransactionTypeEnum.SELECT_DELEGATE, TransactionTypeEnum.STAKE_SELECT_DELEGATE].includes(type)) {
    return 'delegate' in item && item.delegate ? formatAddress(item.delegate, 6, 6) : t`No delegate`;
  }
  if ([TransactionTypeEnum.SELECT_REWARD, TransactionTypeEnum.STAKE_SELECT_REWARD].includes(type)) {
    return 'rewardContract' in item && item.rewardContract
      ? formatAddress(item.rewardContract, 6, 6)
      : t`No reward`;
  }
  if ([TransactionTypeEnum.OPEN, TransactionTypeEnum.STAKE_OPEN].includes(type)) {
    return '';
  }
  return (
    getAmount({ item, type, chainId }) + ' ' + getToken({ type, tradeFromToken, savingsToken, rewardToken })
  );
};
