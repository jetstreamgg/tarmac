import { stUsdsAddress } from '@jetstreamgg/sky-hooks';

export interface ExpertModule {
  name: string;
  tokenAddress: string;
  contractAddress: string;
}

// Expert modules configuration
// TODO: Add more expert modules as they become available
export function getExpertModules(chainId: number): ExpertModule[] {
  const stUsdsTokenAddress = stUsdsAddress[chainId as keyof typeof stUsdsAddress];

  return [
    {
      name: 'stUSDS',
      tokenAddress: stUsdsTokenAddress,
      contractAddress: stUsdsTokenAddress // For stUSDS, token and contract are the same
    }
    // Future expert modules will be added here
  ];
}
