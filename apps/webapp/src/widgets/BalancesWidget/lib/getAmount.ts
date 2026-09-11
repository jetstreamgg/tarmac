import { CombinedHistoryItem, ModuleEnum, Token, TransactionTypeEnum } from '@/hooks';
import { formatBigInt } from '@/utils';
import { absBigInt } from './absBigInt';
import { getTokenDecimals } from '@/hooks';

/** The unsigned raw amount a history item moved, with its token decimals — or nothing when the item carries no amount. */
// TODO this needs to be standardized across modules so that amount is the same property name on each module
export const getRawAmount = ({
  item,
  type,
  chainId
}: {
  item: CombinedHistoryItem;
  type: TransactionTypeEnum;
  chainId: number;
}): { value: bigint; decimals: number } | undefined => {
  switch (item.module) {
    case ModuleEnum.TRADE:
      return {
        value: absBigInt('fromAmount' in item ? item.fromAmount : 0n),
        decimals: getTokenDecimals(
          'fromToken' in item ? (item.fromToken as unknown as Token) : undefined,
          chainId
        )
      };
    case ModuleEnum.UPGRADE:
      switch (item.type) {
        case TransactionTypeEnum.MKR_TO_SKY:
        case TransactionTypeEnum.SKY_TO_MKR:
          return { value: absBigInt('skyAmt' in item ? item.skyAmt : 0n), decimals: 18 };
        case TransactionTypeEnum.DAI_TO_USDS:
        case TransactionTypeEnum.USDS_TO_DAI:
          return { value: absBigInt('wad' in item ? item.wad : 0n), decimals: 18 };
      }
      return undefined;
    case ModuleEnum.REWARDS:
    case ModuleEnum.STAKE:
      return [TransactionTypeEnum.SELECT_DELEGATE, TransactionTypeEnum.SELECT_REWARD].includes(type)
        ? undefined
        : { value: absBigInt('amount' in item ? item.amount : 0n), decimals: 18 };
    case ModuleEnum.SAVINGS:
    case ModuleEnum.STUSDS:
    case ModuleEnum.MORPHO:
    case ModuleEnum.SUSDT:
      return {
        value: absBigInt('assets' in item ? item.assets : 0n),
        decimals: getTokenDecimals('token' in item ? item.token : undefined, chainId)
      };
    case ModuleEnum.PENDLE:
      return {
        value: absBigInt('assets' in item ? item.assets : 0n),
        decimals: 'underlyingDecimals' in item ? item.underlyingDecimals : 18
      };
  }
};

export const getAmount = (args: {
  item: CombinedHistoryItem;
  type: TransactionTypeEnum;
  chainId: number;
}) => {
  const raw = getRawAmount(args);
  if (!raw) return args.item.module === ModuleEnum.UPGRADE ? undefined : '';
  return formatBigInt(raw.value, { compact: true, unit: raw.decimals });
};
