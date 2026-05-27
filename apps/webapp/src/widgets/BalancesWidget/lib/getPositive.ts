import { TransactionTypeEnum } from '@/hooks';

export const getPositive = ({ type }: { type: TransactionTypeEnum }) => {
  switch (type) {
    case TransactionTypeEnum.SELECT_DELEGATE:
    case TransactionTypeEnum.SELECT_REWARD:
    case TransactionTypeEnum.OPEN:
    case TransactionTypeEnum.UNSTAKE_KICK:
    case TransactionTypeEnum.STAKE_OPEN:
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
      return undefined;

    case TransactionTypeEnum.WITHDRAW:
    case TransactionTypeEnum.REWARD:
    case TransactionTypeEnum.STAKE_REWARD:
    case TransactionTypeEnum.MKR_TO_SKY:
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.REPAY:
    case TransactionTypeEnum.STAKE:
    case TransactionTypeEnum.STAKE_REPAY:
      return true;

    // Pendle rows render the PT amount, so sign follows PT direction:
    // Buy adds PT to the user's position (+), Sell/Redeem remove it (−).
    case TransactionTypeEnum.PENDLE_BUY:
      return true;
    case TransactionTypeEnum.PENDLE_SELL:
    case TransactionTypeEnum.PENDLE_REDEEM:
      return false;

    case TransactionTypeEnum.USDS_TO_DAI:
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.TRADE:
    case TransactionTypeEnum.SUPPLY:
    case TransactionTypeEnum.BORROW:
    case TransactionTypeEnum.STAKE_BORROW:
    case TransactionTypeEnum.UNSTAKE:
    default:
      return false;
  }
};
