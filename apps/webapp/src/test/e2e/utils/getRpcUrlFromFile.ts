import { readFile } from 'fs/promises';
import { NetworkName } from './constants';

type TestnetData = { NETWORK: string; TENDERLY_TESTNET_ID: string; TENDERLY_RPC_URL: string };

export const getRpcUrlFromFile = async (network: NetworkName): Promise<string> => {
  const vnetFile = '../../tenderlyTestnetData.json';
  const file = await readFile(vnetFile, 'utf-8');
  const data = JSON.parse(file);

  const networkData = data.find((item: TestnetData) => item.NETWORK === network);

  if (!networkData) {
    throw new Error(`No RPC URL found for network ${network} in ${vnetFile}`);
  }

  return networkData.TENDERLY_RPC_URL;
};
