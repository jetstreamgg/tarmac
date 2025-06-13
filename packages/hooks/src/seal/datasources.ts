import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { sealModuleAddress } from '../generated';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';

export function lseDataSource(chainId: number, functionName: string, contractName = 'SealModule Contract') {
  return {
    title: `${contractName}. ${functionName}`,
    onChain: true,
    href: getEtherscanLink(chainId, sealModuleAddress[chainId as keyof typeof sealModuleAddress], 'address'),
    trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
  };
}
