import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

export const mineBlock = async (network = NetworkName.mainnet) => {
  const rpcUrl = await getRpcUrlFromFile(network);

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

  console.log('Successfully mined block');
};
