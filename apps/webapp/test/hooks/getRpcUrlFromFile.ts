import { readFile } from 'fs/promises';
import { NetworkName } from './constants';

type TestnetData = { NETWORK: string; TENDERLY_TESTNET_ID: string; TENDERLY_RPC_URL: string };

export const getRpcUrlFromFile = async (network: NetworkName): Promise<string> => {
  // Use alternate VNet config when USE_ALTERNATE_VNET env var is set
  const useAlternateVnet = process.env.USE_ALTERNATE_VNET === 'true';
  const configFile = useAlternateVnet
    ? '../../tenderlyTestnetData-alternate.json'
    : '../../tenderlyTestnetData.json';
  const file = await readFile(configFile, 'utf-8');
  const data = JSON.parse(file);

  const networkData = data.find((item: TestnetData) => item.NETWORK === network);

  if (!networkData) {
    throw new Error(`No RPC URL found for network ${network}`);
  }

  return networkData.TENDERLY_RPC_URL;
};
