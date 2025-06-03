import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { NetworkName } from './constants';

export const distributeRewards = async () => {
  const TENDERLY_RPC_URL = await getRpcUrlFromFile(NetworkName.mainnet);
  const VESTED_REWARDS_DISTRIBUTION = '0x2f0c88e935db5a60dda73b0b4eaeef55883896d9'; // Address of the `VestedRewardsDistribution` contract

  const distributeResponse = await fetch(TENDERLY_RPC_URL, {
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
          from: '0x0000000000000000000000000000000000000000',
          to: VESTED_REWARDS_DISTRIBUTION,
          gas: '0x7A1200',
          gasPrice: '0x0',
          value: '0x0',
          data: '0xe4fc6b6d'
        }
      ]
    })
  });

  if (!distributeResponse.ok) {
    throw new Error(`Error: ${distributeResponse.statusText}`);
  }

  const blockMineResponse = await fetch(TENDERLY_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'evm_increaseTime',
      params: ['0xE10']
    })
  });

  if (!blockMineResponse.ok) {
    throw new Error(`Error: ${blockMineResponse.statusText}`);
  }
};
