import { readFile } from 'fs/promises';
import path from 'path';

// This function waits for a single vnet
export const waitForVnetReady = async (chain: string) => {
  const filePath = path.resolve('../../tenderlyTestnetData.json');
  const file = await readFile(filePath, 'utf-8');
  const data = JSON.parse(file);

  const networkData = data.find((item: any) => item.NETWORK === chain);
  if (!networkData) {
    throw new Error(`No data found for network ${chain}`);
  }

  // Wait for the specific chain to be ready
  const response = await fetch(networkData.TENDERLY_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_blockNumber',
      params: []
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to connect to ${chain} network`);
  }
};
