import { readFile } from 'fs/promises';

type TenderlyTestnetDataFile = {
  NETWORK: string;
  TENDERLY_TESTNET_ID: string;
  TENDERLY_RPC_URL: string;
}[];

type EvmSnapshotResponse = {
  id: number;
  jsonrpc: string;
  result: string;
};

type EvmRevertResponse = {
  id: number;
  jsonrpc: string;
  result: boolean;
};

export const evmSnapshot = async (chain: string): Promise<string> => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const testnetsData: TenderlyTestnetDataFile = JSON.parse(file);

  const networkData = testnetsData.find(item => item.NETWORK === chain);
  if (!networkData) {
    throw new Error(`No data found for network ${chain}`);
  }

  const res = await fetch(networkData.TENDERLY_RPC_URL, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'evm_snapshot',
      params: [],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  const data: EvmSnapshotResponse = await res.json();
  return data.result;
};

export const evmRevert = async (chain: string, snapshotId: string): Promise<boolean> => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const testnetsData: TenderlyTestnetDataFile = JSON.parse(file);

  const networkData = testnetsData.find(item => item.NETWORK === chain);
  if (!networkData) {
    throw new Error(`No data found for network ${chain}`);
  }

  const res = await fetch(networkData.TENDERLY_RPC_URL, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'evm_revert',
      params: [snapshotId],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  const data: EvmRevertResponse = await res.json();
  return data.result;
};
