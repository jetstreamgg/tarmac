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
  // Use alternate VNet config when USE_ALTERNATE_VNET env var is set
  const useAlternateVnet = process.env.USE_ALTERNATE_VNET === 'true';
  const configFile = useAlternateVnet
    ? '../../tenderlyTestnetData-alternate.json'
    : '../../tenderlyTestnetData.json';
  const file = await readFile(configFile, 'utf-8');
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

/**
 * Calculate the storage slot for a field in a Solidity mapping(bytes32 => struct).
 *
 * @param ilkName - The ilk name as a string (e.g., 'LSEV2-SKY-A')
 * @param mappingSlot - The storage slot of the mapping in the contract
 * @param fieldOffset - The offset of the field within the struct (0-indexed)
 * @returns The storage slot as a hex string
 *
 * @example
 * // For Vat.ilks["LSEV2-SKY-A"].Art where ilks is at slot 2 and Art is field 0:
 * calculateIlkStorageSlot('LSEV2-SKY-A', 2, 0)
 */
function calculateIlkStorageSlot(ilkName: string, mappingSlot: number, fieldOffset: number): `0x${string}` {
  const { keccak256, encodeAbiParameters, parseAbiParameters, stringToHex, pad } = require('viem');

  // Convert ilk name to bytes32 (right-padded with zeros)
  const ilkBytes32 = pad(stringToHex(ilkName), { size: 32, dir: 'right' });

  // Calculate base slot: keccak256(abi.encode(ilkName, mappingSlot))
  const encoded = encodeAbiParameters(parseAbiParameters('bytes32, uint256'), [
    ilkBytes32,
    BigInt(mappingSlot)
  ]);
  const base = keccak256(encoded);

  // Add field offset to get the specific field's slot
  const slot = BigInt(base) + BigInt(fieldOffset);

  // Return as properly padded hex string
  return ('0x' + slot.toString(16).padStart(64, '0')) as `0x${string}`;
}

/**
 * Set storage at a specific slot in a contract on the VNet.
 * Used to configure protocol parameters like debt ceilings.
 */
const setStorageAtRequest = async (
  contractAddress: string,
  slot: string,
  value: string,
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
      method: 'tenderly_setStorageAt',
      params: [contractAddress, slot, value],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error setting storage: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }
};

export const setStorageAt = async (
  contractAddress: string,
  slot: string,
  value: string,
  network = NetworkName.mainnet
) => {
  await backOffRetry(() => setStorageAtRequest(contractAddress, slot, value, network), 3, 1);
};

const VAT_ADDRESS = '0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B';
const ILK_NAME = 'LSEV2-SKY-A';
const ILKS_MAPPING_SLOT = 2;

const LSEV2_SKY_A_LINE_SLOT = calculateIlkStorageSlot(ILK_NAME, ILKS_MAPPING_SLOT, 3);
const HIGH_DEBT_CEILING = '0x000000000000009f4f2726179a224501d762422c946590d91000000000000000';

export const setStakeModuleDebtCeiling = async () => {
  await setStorageAt(VAT_ADDRESS, LSEV2_SKY_A_LINE_SLOT, HIGH_DEBT_CEILING);
};

const STUSDS_ADDRESS = '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9';
const STUSDS_CAP_SLOT = '0x0000000000000000000000000000000000000000000000000000000000000007';
const HIGH_STUSDS_CAP = '0x000000000000000000000000000000000000000c9f2c9cd04674edea40000000';

export const setStUsdsCap = async () => {
  await setStorageAt(STUSDS_ADDRESS, STUSDS_CAP_SLOT, HIGH_STUSDS_CAP);
};

const LSEV2_SKY_A_SPOT_SLOT = calculateIlkStorageSlot(ILK_NAME, ILKS_MAPPING_SLOT, 2);
const HIGH_SPOT = '0x0000000000000000000000000000000000000000033b2e3c9fd0803ce8000000';

export const setStakeModuleSpot = async () => {
  await setStorageAt(VAT_ADDRESS, LSEV2_SKY_A_SPOT_SLOT, HIGH_SPOT);
};

const LSEV2_SKY_A_ART_SLOT = calculateIlkStorageSlot(ILK_NAME, ILKS_MAPPING_SLOT, 0);
const MODERATE_DEBT = '0x00000000000000000000000000000000000000000000d3c21bcecceda1000000';

export const reduceStakeModuleDebt = async () => {
  await setStorageAt(VAT_ADDRESS, LSEV2_SKY_A_ART_SLOT, MODERATE_DEBT);
};

const SPOTTER_ADDRESS = '0x65C79fcB50Ca1594B025960e539eD7A9a6D434A3';
const SPOTTER_ILKS_MAPPING_SLOT = 1;
const LSEV2_SKY_A_MAT_SLOT = calculateIlkStorageSlot(ILK_NAME, SPOTTER_ILKS_MAPPING_SLOT, 1);
const LSEV2_SKY_A_MAT = '0x000000000000000000000000000000000000000009b18ab5df7180b6b8000000';

export const setStakeModuleMat = async () => {
  await setStorageAt(SPOTTER_ADDRESS, LSEV2_SKY_A_MAT_SLOT, LSEV2_SKY_A_MAT);
};
