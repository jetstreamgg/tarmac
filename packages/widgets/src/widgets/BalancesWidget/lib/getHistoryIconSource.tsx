import { TransactionTypeEnum, ModuleEnum } from '@jetstreamgg/hooks';
import { isBaseChainId } from '@jetstreamgg/utils';

export const getHistoryIconSource = ({
  type,
  module,
  chainId
}: {
  type?: TransactionTypeEnum;
  module: ModuleEnum;
  chainId: number;
}) => {
  const isBase = isBaseChainId(chainId);
  const src = 'history-icons/' + (isBase ? 'base/' : 'ethereum/');
  switch (module) {
    case ModuleEnum.SAVINGS:
      return type === TransactionTypeEnum.SUPPLY ? src + 'savings-supply.svg' : src + 'savings-withdraw.svg';
    case ModuleEnum.UPGRADE:
      return type === TransactionTypeEnum.DAI_TO_USDS || type === TransactionTypeEnum.MKR_TO_SKY
        ? src + 'upgrade.svg'
        : src + 'revert.svg';
    case ModuleEnum.TRADE:
      return src + 'trade.svg';
    case ModuleEnum.REWARDS:
      return type === TransactionTypeEnum.SUPPLY
        ? src + 'rewards-supply.svg'
        : type === TransactionTypeEnum.REWARD
          ? src + 'claim.svg'
          : src + 'rewards-withdraw.svg';
    case ModuleEnum.SEAL:
      return src + 'seal.svg';
  }
};
