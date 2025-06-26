import { encodeFunctionData, erc20Abi, parseEther } from 'viem';
import { NetworkName, TEST_ADDRESS } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

export const approveToken = async (
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  amount: string,
  network = NetworkName.mainnet
) => {
  const rpcUrl = await getRpcUrlFromFile(network);

  const amountToApprove = parseEther(amount);

  const calldata = encodeFunctionData({
    abi: erc20Abi,
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
