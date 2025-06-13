import { TransactionTypeEnum } from '@jetstreamgg/sky-hooks';

export const getPositive = ({ type }: { type: TransactionTypeEnum }) => {
  switch (type) {
    case TransactionTypeEnum.SELECT_DELEGATE:
    case TransactionTypeEnum.SELECT_REWARD:
    case TransactionTypeEnum.OPEN:
    case TransactionTypeEnum.STAKE_REWARD:
    case TransactionTypeEnum.UNSTAKE_KICK:
    case TransactionTypeEnum.STAKE_OPEN:
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
      return undefined;

    case TransactionTypeEnum.WITHDRAW:
    case TransactionTypeEnum.REWARD:
    case TransactionTypeEnum.MKR_TO_SKY:
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.REPAY:
    case TransactionTypeEnum.SEAL:
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.STAKE_REPAY:
      return true;
    case TransactionTypeEnum.USDS_TO_DAI:
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.TRADE:
    case TransactionTypeEnum.SUPPLY:
    case TransactionTypeEnum.BORROW:
    case TransactionTypeEnum.UNSEAL:
    case TransactionTypeEnum.STAKE_BORROW:
    case TransactionTypeEnum.UNSTAKE:
    default:
      return false;
  }
};
