import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import {
  getSaDrawCalldata,
  getSaLockMkrCalldata,
  getSaMulticallCalldata,
  getSaOpenCalldata,
  getSaSelectDelegateCalldata,
  getSaSelectRewardContractCalldata,
  sealModuleAddress
} from '@jetstreamgg/sky-hooks';
import { parseEther } from 'viem';
import { NetworkName, TEST_ADDRESS } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

// NOTE: This utility creates existing seal positions for testing purposes.
// Even though the UI no longer supports creating new seal positions,
// this utility is still needed to set up test data for unsealing tests.
export const newSealPosition = async (
  mkrAmount: string,
  delegateAddress: `0x${string}`,
  rewardContractAddress: `0x${string}`,
  usdsAmount?: string
) => {
  const TENDERLY_RPC_URL = await getRpcUrlFromFile(NetworkName.mainnet);

  const URN_INDEX = 0n;
  const MKR_TO_LOCK = parseEther(mkrAmount);
  const USDS_TO_DRAW = usdsAmount ? parseEther(usdsAmount) : undefined;

  // Generate calldata for each operation
  const calldataOpen = getSaOpenCalldata({ urnIndex: URN_INDEX });

  const calldataLockMkr = getSaLockMkrCalldata({
    ownerAddress: TEST_ADDRESS,
    urnIndex: URN_INDEX,
    amount: MKR_TO_LOCK
  });

  const calldataDrawNst = USDS_TO_DRAW
    ? getSaDrawCalldata({
        ownerAddress: TEST_ADDRESS,
        urnIndex: URN_INDEX,
        toAddress: TEST_ADDRESS,
        amount: USDS_TO_DRAW
      })
    : undefined;

  const calldataSelectRewardContract = getSaSelectRewardContractCalldata({
    ownerAddress: TEST_ADDRESS,
    urnIndex: URN_INDEX,
    rewardContractAddress
  });

  const calldataSelectDelegate = getSaSelectDelegateCalldata({
    ownerAddress: TEST_ADDRESS,
    urnIndex: URN_INDEX,
    delegateAddress
  });

  // Encode function calls as bytes arrays
  const calldata = [
    calldataOpen,
    calldataLockMkr,
    ...(calldataDrawNst ? [calldataDrawNst] : []),
    calldataSelectRewardContract,
    calldataSelectDelegate
  ];

  const response = await fetch(TENDERLY_RPC_URL, {
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
          to: sealModuleAddress[TENDERLY_CHAIN_ID],
          gas: '0x7A1200',
          gasPrice: '0x0',
          value: '0x0',
          data: getSaMulticallCalldata({ calldata })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Error creating Seal position: ${response.statusText}`);
  }

  // Mine a block to confirm the transaction
  const blockMineResponse = await fetch(TENDERLY_RPC_URL, {
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

  console.log('Successfully created new Seal position');
};
