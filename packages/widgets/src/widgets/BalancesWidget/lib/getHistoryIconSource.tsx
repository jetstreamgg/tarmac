import { TransactionTypeEnum, ModuleEnum } from '@jetstreamgg/sky-hooks';

export const getHistoryIconSource = ({
  type,
  module
}: {
  type?: TransactionTypeEnum;
  module: ModuleEnum;
}) => {
  const src = 'history-icons/';
  switch (module) {
    case ModuleEnum.SAVINGS:
    case ModuleEnum.STUSDS:
    case ModuleEnum.MORPHO:
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
    case ModuleEnum.STAKE:
      return type && [TransactionTypeEnum.STAKE].includes(type)
        ? src + 'stake.svg'
        : type && [TransactionTypeEnum.STAKE_REPAY].includes(type)
          ? src + 'repaid.svg'
          : type && [TransactionTypeEnum.UNSTAKE].includes(type)
            ? src + 'unstake.svg'
            : type && [TransactionTypeEnum.STAKE_OPEN].includes(type)
              ? src + 'open_position.svg'
              : type && [TransactionTypeEnum.STAKE_SELECT_DELEGATE].includes(type)
                ? src + 'delegate.svg'
                : type && [TransactionTypeEnum.STAKE_BORROW].includes(type)
                  ? src + 'borrow.svg'
                  : type && [TransactionTypeEnum.STAKE_REWARD].includes(type)
                    ? src + 'claim_rewards.svg'
                    : type && [TransactionTypeEnum.UNSTAKE_KICK].includes(type)
                      ? src + 'liquidated.svg'
                      : type && [TransactionTypeEnum.STAKE_SELECT_REWARD].includes(type)
                        ? src + 'select_reward.svg'
                        : '';
  }
};
