import { readFile } from 'fs/promises';
import { NetworkName } from './constants';

type TestnetData = { NETWORK: string; TENDERLY_TESTNET_ID: string; TENDERLY_RPC_URL: string };

/**
 * Get the appropriate VNet data file based on environment
 * - Alternate tests use tenderlyTestnetData-alternate.json (for specialized fork state)
 * - All other tests use tenderlyTestnetData.json (standard fork)
 */
function getVnetDataFile(): string {
  const useAlternateVnet = process.env.USE_ALTERNATE_VNET === 'true';
  return useAlternateVnet ? '../../tenderlyTestnetData-alternate.json' : '../../tenderlyTestnetData.json';
}

export const getRpcUrlFromFile = async (network: NetworkName): Promise<string> => {
  const vnetFile = getVnetDataFile();
  const file = await readFile(vnetFile, 'utf-8');
  const data = JSON.parse(file);

  const networkData = data.find((item: TestnetData) => item.NETWORK === network);

  if (!networkData) {
    throw new Error(`No RPC URL found for network ${network} in ${vnetFile}`);
  }

  return networkData.TENDERLY_RPC_URL;
};
