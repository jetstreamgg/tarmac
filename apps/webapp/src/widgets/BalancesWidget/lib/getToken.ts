import { CombinedHistoryItem, TransactionTypeEnum } from '@/hooks';
import { t } from '@lingui/core/macro';

export const getToken = ({
  item,
  type,
  tradeFromToken,
  savingsToken,
  rewardToken
}: {
  item: CombinedHistoryItem;
  type: TransactionTypeEnum;
  tradeFromToken?: string;
  savingsToken?: string;
  rewardToken?: string;
}) => {
  switch (type) {
    case TransactionTypeEnum.SUPPLY: //TODO: account for other reward contracts
    case TransactionTypeEnum.WITHDRAW:
      return savingsToken || t`USDS`;
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.USDS_TO_DAI:
    case TransactionTypeEnum.BORROW:
    case TransactionTypeEnum.REPAY:
    case TransactionTypeEnum.STAKE_BORROW:
    case TransactionTypeEnum.STAKE_REPAY:
      return t`USDS`;
    case TransactionTypeEnum.STAKE_REWARD:
      return rewardToken || t`USDS`;
    case TransactionTypeEnum.MKR_TO_SKY:
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.SEAL_SKY:
    case TransactionTypeEnum.UNSEAL_SKY:
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.UNSTAKE:
      return t`SKY`;
    case TransactionTypeEnum.TRADE:
      return tradeFromToken || 'Token';
    case TransactionTypeEnum.REWARD:
      return rewardToken || t`SKY`;
    case TransactionTypeEnum.SEAL:
    case TransactionTypeEnum.UNSEAL:
      return t`MKR`;
    case TransactionTypeEnum.PENDLE_BUY:
    case TransactionTypeEnum.PENDLE_SELL:
    case TransactionTypeEnum.PENDLE_REDEEM:
      return 'underlyingSymbol' in item ? item.underlyingSymbol : '';
    default:
      return '';
  }
};
