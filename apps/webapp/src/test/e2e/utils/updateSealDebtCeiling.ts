import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { getIlkName } from '@jetstreamgg/sky-hooks';
import {
  mcdVatAbi,
  mcdVatAddress,
  sealModuleAddress
} from 'node_modules/@jetstreamgg/sky-hooks/src/generated';
import { encodeFunctionData, stringToHex } from 'viem';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

export const updateSealDebtCeiling = async (newDebtCeiling: bigint) => {
  const TENDERLY_MAINNET_RPC_URL = await getRpcUrlFromFile(NetworkName.mainnet);

  // The seal module contract is authorized to change the `line` parameter
  const AUTHORIZED_ADDRESS = sealModuleAddress[TENDERLY_CHAIN_ID];

  // Use version 2 for SKY staking (LSEV2_SKY_A ilk)
  const ilkName = getIlkName(2);
  const ilkHex = stringToHex(ilkName, { size: 32 });

  const encodedLineName = stringToHex('line', { size: 32 });

  const calldata = encodeFunctionData({
    abi: mcdVatAbi,
    functionName: 'file',
    args: [ilkHex, encodedLineName, newDebtCeiling]
  });

  const response = await fetch(TENDERLY_MAINNET_RPC_URL, {
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
          from: AUTHORIZED_ADDRESS,
          to: mcdVatAddress[TENDERLY_CHAIN_ID],
          gas: '0x7A1200',
          gasPrice: '0x0',
          value: '0x0',
          data: calldata
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Error increasing debt ceiling: ${response.statusText}`);
  }

  // Mine a block to confirm the transaction
  const blockMineResponse = await fetch(TENDERLY_MAINNET_RPC_URL, {
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

  console.log('Successfully increased debt ceiling');
};
