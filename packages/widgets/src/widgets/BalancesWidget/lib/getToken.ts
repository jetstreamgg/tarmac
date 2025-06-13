import { TransactionTypeEnum } from '@jetstreamgg/sky-hooks';
import { t } from '@lingui/core/macro';

export const getToken = ({
  type,
  tradeFromToken,
  savingsToken
}: {
  type: TransactionTypeEnum;
  tradeFromToken?: string;
  savingsToken?: string;
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
    case TransactionTypeEnum.STAKE_REWARD:
      return t`USDS`;
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
      return t`SKY`; //TODO: handle other reward contracts
    case TransactionTypeEnum.SEAL:
    case TransactionTypeEnum.UNSEAL:
      return t`MKR`;
    default:
      return '';
  }
};
