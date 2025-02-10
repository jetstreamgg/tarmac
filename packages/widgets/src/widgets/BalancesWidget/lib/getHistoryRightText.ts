import { CombinedHistoryItem, TransactionTypeEnum } from '@jetstreamgg/hooks';
import { getAmount } from './getAmount';
import { getToken } from './getToken';
import { formatAddress } from '@jetstreamgg/utils';
import { t } from '@lingui/core/macro';

export const getHistoryRightText = ({
  item,
  type,
  tradeFromToken,
  savingsToken,
  chainId
}: {
  item: CombinedHistoryItem;
  type: TransactionTypeEnum;
  tradeFromToken?: string;
  savingsToken?: string;
  chainId: number;
}) => {
  if (type == TransactionTypeEnum.SELECT_DELEGATE) {
    return 'delegate' in item ? formatAddress(item.delegate, 6, 6) : t`No delegate`;
  }
  if (type == TransactionTypeEnum.SELECT_REWARD) {
    return 'rewardContract' in item ? formatAddress(item.rewardContract, 6, 6) : t`No reward`;
  }
  if (type == TransactionTypeEnum.OPEN) {
    return '';
  }
  return getAmount({ item, type, chainId }) + ' ' + getToken({ type, tradeFromToken, savingsToken });
};
