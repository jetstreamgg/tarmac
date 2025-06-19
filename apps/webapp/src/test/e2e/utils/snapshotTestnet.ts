import { readFile } from 'fs/promises';

type TenderlyTestnetDataFile = {
  NETWORK: string;
  TENDERLY_TESTNET_ID: string;
  TENDERLY_RPC_URL: string;
}[];

type RpcResponse<T> = {
  id: number;
  jsonrpc: string;
  result: T;
};

export type SnapshotInfo = {
  chain: string;
  snapshotId: string;
};

const makeRpcRequest = async <T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> => {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method,
      params,
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RPC request failed for ${rpcUrl} with method ${method}: ${errorText}`);
  }

  const data: RpcResponse<T> = await res.json();
  return data.result;
};

const getTestnetsData = async (): Promise<TenderlyTestnetDataFile> => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  return JSON.parse(file);
};

export const evmSnapshot = async (chain?: string): Promise<string | SnapshotInfo[]> => {
  const testnetsData = await getTestnetsData();

  if (chain) {
    const networkData = testnetsData.find(item => item.NETWORK === chain);
    if (!networkData) {
      throw new Error(`No data found for network ${chain}`);
    }
    return makeRpcRequest<string>(networkData.TENDERLY_RPC_URL, 'evm_snapshot', []);
  }

  const responses = await Promise.all(
    testnetsData.map(async network => {
      const snapshotId = await makeRpcRequest<string>(network.TENDERLY_RPC_URL, 'evm_snapshot', []);
      return { chain: network.NETWORK, snapshotId };
    })
  );

  return responses;
};

export const evmRevert = async (chain: string, snapshotId: string): Promise<boolean> => {
  const testnetsData = await getTestnetsData();

  const networkData = testnetsData.find(item => item.NETWORK === chain);
  if (!networkData) {
    throw new Error(`No data found for network ${chain}`);
  }

  return makeRpcRequest<boolean>(networkData.TENDERLY_RPC_URL, 'evm_revert', [snapshotId]);
};
