import { TransactionTypeEnum, ModuleEnum } from '@jetstreamgg/sky-hooks';
import { capitalizeFirstLetter } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';

export const getTitle = ({ type, module }: { type: TransactionTypeEnum; module: ModuleEnum }) => {
  switch (type) {
    case TransactionTypeEnum.DAI_TO_USDS:
    case TransactionTypeEnum.MKR_TO_SKY:
      return t`Upgrade`;
    case TransactionTypeEnum.SKY_TO_MKR:
    case TransactionTypeEnum.USDS_TO_DAI:
      return t`Revert`;
    case TransactionTypeEnum.TRADE:
      return t`Trade`;
    case TransactionTypeEnum.SUPPLY:
      if (module === ModuleEnum.REWARDS) {
        return t`Rewards Supply`;
      } else if (module === ModuleEnum.SAVINGS) {
        return t`Savings Supply`;
      } else if (module === ModuleEnum.STUSDS) {
        return t`stUSDS Supply`;
      } else if (module === ModuleEnum.MORPHO) {
        return t`Morpho Vault Supply`;
      }
      return t`Supply`;
    case TransactionTypeEnum.WITHDRAW:
      if (module === ModuleEnum.REWARDS) {
        return t`Rewards Withdraw `;
      } else if (module === ModuleEnum.SAVINGS) {
        return t`Savings Withdraw`;
      } else if (module === ModuleEnum.STUSDS) {
        return t`stUSDS Withdraw`;
      } else if (module === ModuleEnum.MORPHO) {
        return t`Morpho Vault Withdraw`;
      }
      return t`Withdraw`;
    case TransactionTypeEnum.REWARD:
      return t`Claim rewards`;
    case TransactionTypeEnum.STAKE_OPEN:
      return t`Open position`;
    case TransactionTypeEnum.STAKE:
      return t`Stake`;
    case TransactionTypeEnum.UNSTAKE:
      return t`Unstake`;
    case TransactionTypeEnum.STAKE_REWARD:
      return t`Claim rewards`;
    case TransactionTypeEnum.STAKE_BORROW:
      return t`Borrow`;
    case TransactionTypeEnum.STAKE_REPAY:
      return t`Repay`;
    case TransactionTypeEnum.STAKE_SELECT_DELEGATE:
      return t`Select delegate`;
    case TransactionTypeEnum.STAKE_SELECT_REWARD:
      return t`Select reward`;
    case TransactionTypeEnum.UNSTAKE_KICK:
      return t`Liquidation`;
    default:
      return capitalizeFirstLetter((type || module).toLowerCase().replace('_', ' '));
  }
};
