import { parseUnits, toHex, encodeFunctionData, stringToHex, formatUnits } from 'viem';
import { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';

/**
 * Sets the supply cap for the stUSDS contract on Tenderly using impersonation.
 * This allows testing both native and Curve provider scenarios.
 *
 * @param capAmount - The new supply cap in USDS (e.g., "10000000" for 10M)
 * @param network - The network to operate on
 */
export async function setStUsdsSupplyCap(capAmount: string, network = NetworkName.mainnet): Promise<void> {
  const rpcUrl = await getRpcUrlFromFile(network);
  const stUsdsAddress = '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9';

  // Admin address that has permissions (from Etherscan, typically the pause proxy)
  // This is the Maker pause proxy which has admin rights
  const adminAddress = '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB';

  // Convert cap amount to wei (18 decimals for USDS)
  const capValue = parseUnits(capAmount, 18);
  const capHex = toHex(capValue);

  console.log(`Setting stUSDS supply cap to ${capAmount} USDS (${capHex})`);

  // Encode the file(bytes32 what, uint256 data) call
  // "cap" as bytes32
  const what = stringToHex('cap', { size: 32 });

  const calldata = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'file',
        inputs: [
          { name: 'what', type: 'bytes32' },
          { name: 'data', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
      }
    ],
    functionName: 'file',
    args: [what, capValue]
  });

  // Send transaction from impersonated admin address
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_sendTransaction',
      params: [
        {
          from: adminAddress,
          to: stUsdsAddress,
          data: calldata,
          gas: '0x7A1200', // 8M gas
          gasPrice: '0x0',
          value: '0x0'
        }
      ],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error setting stUSDS supply cap: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC error setting stUSDS supply cap: ${JSON.stringify(data.error)}`);
  }

  console.log(`Transaction hash: ${data.result}`);

  // Mine a block to confirm the transaction
  const mineResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'evm_mine',
      params: [],
      id: 43,
      jsonrpc: '2.0'
    })
  });

  if (!mineResponse.ok) {
    throw new Error(`Error mining block: ${mineResponse.statusText}`);
  }

  console.log(`✅ Successfully set stUSDS supply cap to ${capAmount} USDS`);
}

/**
 * Gets the current supply cap from the stUSDS contract.
 * Useful for verifying the cap was set correctly.
 */
export async function getStUsdsSupplyCap(network = NetworkName.mainnet): Promise<bigint> {
  const rpcUrl = await getRpcUrlFromFile(network);
  const stUsdsAddress = '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9';

  // Call cap() function to get the cap value
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
          to: stUsdsAddress,
          data: '0x355274ea' // cap() function selector
        },
        'latest'
      ],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!response.ok) {
    throw new Error(`Error getting stUSDS supply cap: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`RPC error getting stUSDS supply cap: ${JSON.stringify(data.error)}`);
  }

  return BigInt(data.result);
}

/**
 * Convenience function to set a very high cap to enable native provider testing.
 * Sets cap to 1 billion USDS which should be sufficient for all tests.
 *
 * Note: We only set 'cap', not 'line'. The stUSDS contract's 'line' parameter
 * is different from the VAT debt ceiling and setting it to a large value causes
 * overflow errors in debt utilization calculations.
 */
export async function enableNativeProvider(network = NetworkName.mainnet): Promise<void> {
  await setStUsdsSupplyCap('1000000000', network); // 1B USDS cap

  // Verify cap was set
  const cap = await getStUsdsSupplyCap(network);
  console.log(`✅ Native provider enabled - cap: ${cap / BigInt(1e18)} USDS`);
}

/**
 * Convenience function to set cap to current supply to force Curve provider.
 * This simulates the "supply cap reached" scenario.
 */
export async function forceCurveProvider(network = NetworkName.mainnet): Promise<void> {
  // Get current total assets
  const rpcUrl = await getRpcUrlFromFile(network);
  const stUsdsAddress = '0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9';

  // Call totalAssets() to get current supply
  const totalAssetsResponse = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      method: 'eth_call',
      params: [
        {
          to: stUsdsAddress,
          data: '0x01e1d114' // totalAssets() function selector
        },
        'latest'
      ],
      id: 42,
      jsonrpc: '2.0'
    })
  });

  if (!totalAssetsResponse.ok) {
    throw new Error(`Error getting total assets: ${totalAssetsResponse.statusText}`);
  }

  const totalAssetsData = await totalAssetsResponse.json();
  const totalAssets = BigInt(totalAssetsData.result);

  console.log(`Current total assets: ${formatUnits(totalAssets, 18)} USDS`);

  // Set cap to current total assets MINUS 1 USDS to guarantee it's blocked
  // This ensures remaining capacity will be negative (i.e., 0)
  const capValue = totalAssets > 0n ? totalAssets - parseUnits('1', 18) : 0n;
  const capInUsds = formatUnits(capValue, 18);

  await setStUsdsSupplyCap(capInUsds, network);

  console.log('✅ Curve provider forced (cap set below current supply)');
  console.log(`Cap set to: ${capInUsds} USDS (supply - 1 USDS)`);
}
