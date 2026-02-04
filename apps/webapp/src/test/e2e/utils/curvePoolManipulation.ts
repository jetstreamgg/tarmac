import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { NetworkName } from './constants';
import { createPublicClient, http } from 'viem';

/**
 * Curve pool manipulation utilities for E2E testing.
 * Allows draining liquidity and manipulating pool state to test provider selection.
 */

const CURVE_POOL_ADDRESS = '0x2C7C98A3b1582D83c43987202aEFf638312478aE';
const USDS_ADDRESS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

// Curve pool ABI - minimal required functions
const CURVE_POOL_ABI = [
  {
    name: 'balances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'i', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'coins',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'i', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }]
  }
] as const;

/**
 * Curve pool reserves data
 */
export type CurvePoolReserves = {
  usdsReserve: bigint;
  stUsdsReserve: bigint;
  usdsIndex: number;
  stUsdsIndex: number;
};

/**
 * Get Tenderly RPC URL for mainnet
 */
async function getTenderlyRpcUrl(): Promise<string> {
  return getRpcUrlFromFile(NetworkName.mainnet);
}

/**
 * Get Tenderly public client
 */
async function getTenderlyClient() {
  const rpcUrl = await getTenderlyRpcUrl();
  return createPublicClient({
    transport: http(rpcUrl)
  });
}

/**
 * Read current Curve pool reserves.
 */
export async function getCurvePoolReserves(): Promise<CurvePoolReserves> {
  const client = await getTenderlyClient();

  // Get token indices
  const coin0 = (await client.readContract({
    address: CURVE_POOL_ADDRESS,
    abi: CURVE_POOL_ABI,
    functionName: 'coins',
    args: [0n]
  })) as `0x${string}`;

  const usdsIndex = coin0.toLowerCase() === USDS_ADDRESS.toLowerCase() ? 0 : 1;
  const stUsdsIndex = usdsIndex === 0 ? 1 : 0;

  // Get balances
  const balance0 = (await client.readContract({
    address: CURVE_POOL_ADDRESS,
    abi: CURVE_POOL_ABI,
    functionName: 'balances',
    args: [0n]
  })) as bigint;

  const balance1 = (await client.readContract({
    address: CURVE_POOL_ADDRESS,
    abi: CURVE_POOL_ABI,
    functionName: 'balances',
    args: [1n]
  })) as bigint;

  const usdsReserve = usdsIndex === 0 ? balance0 : balance1;
  const stUsdsReserve = stUsdsIndex === 0 ? balance0 : balance1;

  return {
    usdsReserve,
    stUsdsReserve,
    usdsIndex,
    stUsdsIndex
  };
}
