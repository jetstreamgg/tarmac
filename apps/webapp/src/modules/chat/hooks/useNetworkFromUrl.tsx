import { tenderly } from '@/data/wagmi/config/config.default';
import { QueryParams } from '@/lib/constants';
import { normalizeUrlParam } from '@/lib/helpers/string/normalizeUrlParam';
import { testnetNameMapping } from '../lib/intentUtils';
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';

const validNetworks = [
  normalizeUrlParam(base.name),
  normalizeUrlParam(mainnet.name),
  normalizeUrlParam(arbitrum.name),
  'arbitrum',
  normalizeUrlParam(tenderly.name),
  normalizeUrlParam(unichain.name),
  normalizeUrlParam(optimism.name),
  'optimism'
];

export const getNetworkFromIntentUrl = (url: string) => {
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

export const useNetworkFromIntentUrl = (url: string) => {
  return getNetworkFromIntentUrl(url);
};
