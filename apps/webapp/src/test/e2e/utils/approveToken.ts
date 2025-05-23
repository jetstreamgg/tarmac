import { readFile } from 'fs/promises';
import { encodeFunctionData, parseEther } from 'viem';
import { NetworkName, TEST_ADDRESS } from './constants';

export const approveToken = async (
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  amount: string,
  abi: any,
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

  const amountToApprove = parseEther(amount);

  const calldata = encodeFunctionData({
    abi,
    functionName: 'approve',
    args: [spenderAddress, amountToApprove]
  });

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'eth_sendTransaction',
      params: [
        {
          from: TEST_ADDRESS,
          to: tokenAddress,
          gas: '0x7A1200',
          gasPrice: '0x0',
          value: '0x0',
          data: calldata
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Error approving token: ${response.statusText}`);
  }

  // Mine a block to confirm the transaction
  const blockMineResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'evm_mine',
      params: []
    })
  });

  if (!blockMineResponse.ok) {
    throw new Error(`Error mining block: ${blockMineResponse.statusText}`);
  }

  console.log('Successfully approved token');
};
