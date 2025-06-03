import { readFile } from 'fs/promises';
import { NetworkName, TEST_WALLET_ADDRESS } from './constants';
import { parseEther, parseUnits, toHex } from 'viem';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

async function backOffRetry<T>(fn: () => Promise<T>, retries: number, delay: number): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
    return backOffRetry(fn, retries - 1, delay * 2);
  }
}

const setErc20BalanceRequest = async (
  tokenAddress: string,
  amount: string,
  decimals: number = 18,
  network = NetworkName.mainnet
) => {
  const rpcUrl = await getRpcUrlFromFile(network);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tenderly_setErc20Balance',
      params: [tokenAddress, [TEST_WALLET_ADDRESS], toHex(parseUnits(amount, decimals))],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }
};

export const setErc20Balance = async (
  tokenAddress: string,
  amount: string,
  decimals: number = 18,
  network = NetworkName.mainnet
) => {
  await backOffRetry(() => setErc20BalanceRequest(tokenAddress, amount, decimals, network), 3, 1);
};

const setEthBalanceRequest = async (amount: string, network = NetworkName.mainnet) => {
  const rpcUrl = await getRpcUrlFromFile(network);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tenderly_setBalance',
      params: [[TEST_WALLET_ADDRESS], toHex(parseEther(amount))],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }
};

export const setEthBalance = async (amount: string, network = NetworkName.mainnet) => {
  await backOffRetry(() => setEthBalanceRequest(amount, network), 3, 1);
};

const waitForVnetsReadyRequest = async () => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const testnetsData = JSON.parse(file);

  // We send an `eth_blockNumber` request to the RPC endpoints to "ping" them
  const responses = await Promise.all(
    testnetsData.map(({ TENDERLY_RPC_URL }: { TENDERLY_RPC_URL: string }) =>
      fetch(TENDERLY_RPC_URL, {
        method: 'POST',
        headers: {
          accept: '*/*',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          method: 'eth_blockNumber',
          params: [],
          id: 42,
          jsonrpc: '2.0'
        })
      })
    )
  );

  // If all of the RPC endpoints respond with status 200, it means they are ready
  if (!responses.every(({ status }: { status: number }) => status === 200)) {
    throw new Error('Virtual testnets are not ready');
  }
};

export const waitForVnetsReady = async () => {
  await backOffRetry(() => waitForVnetsReadyRequest(), 6, 1);
};
