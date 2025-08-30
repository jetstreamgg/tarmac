import { tenderly, tenderlyBase } from '@/data/wagmi/config/config.default';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { testnetNameMapping } from '../lib/intentUtils';
import { arbitrum, base, mainnet } from 'viem/chains';

const validNetworks = [
  normalizeUrlParam(base.name),
  normalizeUrlParam(mainnet.name),
  normalizeUrlParam(arbitrum.name),
  normalizeUrlParam(tenderly.name),
  normalizeUrlParam(tenderlyBase.name)
];

export const useNetworkFromIntentUrl = (url: string) => {
  try {
    const urlObj = new URL(url.startsWith('https') ? url : `https://domain.com${url}`);
    const network = urlObj.searchParams.get(QueryParams.Network);
    if (network && validNetworks.includes(network)) {
      return testnetNameMapping[network];
    }

    return undefined;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return undefined;
  }
};
