import { CombinedHistoryItem, ModuleEnum, Token, TransactionTypeEnum } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { absBigInt } from './absBigInt';
import { getTokenDecimals } from '@jetstreamgg/sky-hooks';

// TODO this needs to be standardized across modules so that amount is the same property name on each module
export const getAmount = ({
  item,
  type,
  chainId
}: {
  item: CombinedHistoryItem;
  type: TransactionTypeEnum;
  chainId: number;
}) => {
  switch (item.module) {
    case ModuleEnum.TRADE:
      return formatBigInt(absBigInt('fromAmount' in item ? item.fromAmount : 0n), {
        compact: true,
        unit: 'fromToken' in item ? getTokenDecimals(item.fromToken as Token, chainId) : 18
      });
    case ModuleEnum.UPGRADE:
      switch (item.type) {
        case TransactionTypeEnum.MKR_TO_SKY:
        case TransactionTypeEnum.SKY_TO_MKR:
          return formatBigInt(absBigInt('skyAmt' in item ? item.skyAmt : 0n), { compact: true });
        case TransactionTypeEnum.DAI_TO_USDS:
        case TransactionTypeEnum.USDS_TO_DAI:
          return formatBigInt(absBigInt('wad' in item ? item.wad : 0n), { compact: true });
      }
      break;
    case ModuleEnum.REWARDS:
    case ModuleEnum.SEAL:
    case ModuleEnum.STAKE:
      return [TransactionTypeEnum.SELECT_DELEGATE, TransactionTypeEnum.SELECT_REWARD].includes(type)
        ? ''
        : formatBigInt(absBigInt('amount' in item ? item.amount : 0n), { compact: true });
    case ModuleEnum.SAVINGS:
    case ModuleEnum.STUSDS:
      return formatBigInt(absBigInt('assets' in item ? item.assets : 0n), {
        compact: true,
        unit: 'token' in item ? getTokenDecimals(item.token, chainId) : 18
      });
  }
};
