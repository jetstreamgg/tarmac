import { QueryParams } from '@/lib/constants';

const validNetworks = ['base', 'ethereum', 'arbitrumone'];

export const useNetworkFromIntentUrl = (url: string) => {
  try {
    const urlObj = new URL(url.startsWith('https') ? url : `https://domain.com${url}`);
    const network = urlObj.searchParams.get(QueryParams.Network);
    if (network && validNetworks.includes(network)) {
      return network;
    }
    return undefined;
  } catch (error) {
    console.error('Error parsing URL:', error);
    return undefined;
  }
};
