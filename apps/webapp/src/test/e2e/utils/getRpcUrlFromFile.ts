import { readFile } from 'fs/promises';
import { NetworkName } from './constants';

export const getRpcUrlFromFile = async (network: NetworkName): Promise<string> => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const [
    { TENDERLY_RPC_URL: TENDERLY_MAINNET_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_BASE_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_ARBITRUM_RPC_URL },
    { TENDERLY_RPC_URL: OPTIMISM_RPC_URL },
    { TENDERLY_RPC_URL: UNICHAIN_RPC_URL }
  ] = JSON.parse(file);

  if (network === NetworkName.base) return TENDERLY_BASE_RPC_URL;
  if (network === NetworkName.arbitrum) return TENDERLY_ARBITRUM_RPC_URL;
  if (network === NetworkName.optimism) return OPTIMISM_RPC_URL;
  if (network === NetworkName.unichain) return UNICHAIN_RPC_URL;
  return TENDERLY_MAINNET_RPC_URL;
};
