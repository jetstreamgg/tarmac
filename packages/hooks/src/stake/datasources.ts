import { getEtherscanLink } from '@jetstreamgg/utils';
import { stakeModuleAddress } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';

export function stakeDataSource(
  chainId: number,
  functionName: string,
  contractName = 'StakeModule Contract'
) {
  return {
    title: `${contractName}. ${functionName}`,
    onChain: true,
    href: getEtherscanLink(
      chainId,
      stakeModuleAddress[chainId as keyof typeof stakeModuleAddress],
      'address'
    ),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };
}
