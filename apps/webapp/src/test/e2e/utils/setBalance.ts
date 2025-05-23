import { readFile } from 'fs/promises';
import { NetworkName, TEST_ADDRESS } from './constants';
import { parseEther, parseUnits, toHex } from 'viem';

export async function backOffRetry<T>(fn: () => Promise<T>, retries: number, delay: number): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay * 1000));
    return backOffRetry(fn, retries - 1, delay * 2);
  }
}

const checkBalanceRequest = async (address: string, network = NetworkName.mainnet) => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const [
    { TENDERLY_RPC_URL: TENDERLY_MAINNET_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_BASE_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_ARBITRUM_RPC_URL }
  ] = JSON.parse(file);
  const rpcUrl =
    network === NetworkName.mainnet
      ? TENDERLY_MAINNET_RPC_URL
      : network === NetworkName.base
        ? TENDERLY_BASE_RPC_URL
        : TENDERLY_ARBITRUM_RPC_URL;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error checking balance: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
};

const setEthBalanceRequest = async (
  amount: string,
  network = NetworkName.mainnet,
  address = TEST_ADDRESS
) => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const [
    { TENDERLY_RPC_URL: TENDERLY_MAINNET_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_BASE_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_ARBITRUM_RPC_URL }
  ] = JSON.parse(file);
  const rpcUrl =
    network === NetworkName.mainnet
      ? TENDERLY_MAINNET_RPC_URL
      : network === NetworkName.base
        ? TENDERLY_BASE_RPC_URL
        : TENDERLY_ARBITRUM_RPC_URL;

  console.log(`Setting ETH balance for address ${address} on network ${network} to ${amount}`);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tenderly_setBalance',
      params: [[address], toHex(parseEther(amount))],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error setting balance: ${response.statusText}`);
  }

  // Verify the balance was set correctly
  const newBalance = await checkBalanceRequest(address, network);
  const expectedBalance = toHex(parseEther(amount));

  console.log(`Balance verification for ${address}:`, {
    expected: expectedBalance,
    actual: newBalance,
    network
  });

  if (newBalance !== expectedBalance) {
    throw new Error(`Balance verification failed. Expected: ${expectedBalance}, Got: ${newBalance}`);
  }
};

export const setEthBalance = async (
  amount: string,
  network = NetworkName.mainnet,
  address = TEST_ADDRESS
) => {
  await backOffRetry(() => setEthBalanceRequest(amount, network, address), 3, 2);
};

const checkErc20BalanceRequest = async (
  tokenAddress: string,
  address: string,
  network = NetworkName.mainnet
) => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const [
    { TENDERLY_RPC_URL: TENDERLY_MAINNET_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_BASE_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_ARBITRUM_RPC_URL }
  ] = JSON.parse(file);
  const rpcUrl =
    network === NetworkName.mainnet
      ? TENDERLY_MAINNET_RPC_URL
      : network === NetworkName.base
        ? TENDERLY_BASE_RPC_URL
        : TENDERLY_ARBITRUM_RPC_URL;

  // Call balanceOf function on the ERC20 token contract
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_call',
      params: [
        {
          to: tokenAddress,
          data: `0x70a08231000000000000000000000000${address.slice(2)}` // balanceOf(address) function selector
        },
        'latest'
      ],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error checking ERC20 balance: ${response.statusText}`);
  }

  const data = await response.json();
  // Remove '0x' prefix and any leading zeros from the padded response
  return '0x' + data.result.replace('0x', '').replace(/^0+/, '');
};

const setErc20BalanceRequest = async (
  tokenAddress: string,
  amount: string,
  decimals: number = 18,
  network = NetworkName.mainnet,
  address = TEST_ADDRESS
) => {
  const file = await readFile('../../tenderlyTestnetData.json', 'utf-8');
  const [
    { TENDERLY_RPC_URL: TENDERLY_MAINNET_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_BASE_RPC_URL },
    { TENDERLY_RPC_URL: TENDERLY_ARBITRUM_RPC_URL }
  ] = JSON.parse(file);
  const rpcUrl =
    network === NetworkName.mainnet
      ? TENDERLY_MAINNET_RPC_URL
      : network === NetworkName.base
        ? TENDERLY_BASE_RPC_URL
        : TENDERLY_ARBITRUM_RPC_URL;

  console.log(
    `Setting ERC20 balance for token ${tokenAddress} address ${address} on network ${network} to ${amount}`
  );

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'tenderly_setErc20Balance',
      params: [tokenAddress, [address], toHex(parseUnits(amount, decimals))],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error setting ERC20 balance: ${response.statusText}`);
  }

  // Verify the balance was set correctly
  const newBalance = await checkErc20BalanceRequest(tokenAddress, address, network);
  const expectedBalance = toHex(parseUnits(amount, decimals));

  console.log(`ERC20 balance verification for ${address}:`, {
    token: tokenAddress,
    expected: expectedBalance,
    actual: newBalance,
    network
  });

  if (newBalance !== expectedBalance && newBalance !== '0x') {
    throw new Error(
      `ERC20 balance verification failed. Token: ${tokenAddress}, Expected: ${expectedBalance}, Got: ${newBalance}`
    );
  }
};

export const setErc20Balance = async (
  tokenAddress: string,
  amount: string,
  decimals: number = 18,
  network = NetworkName.mainnet,
  address = TEST_ADDRESS
) => {
  await backOffRetry(() => setErc20BalanceRequest(tokenAddress, amount, decimals, network, address), 3, 2);
};
