#!/usr/bin/env tsx
/**
 * Standalone script to fund test accounts on Tenderly VNets.
 * This script is separate from test execution and can be run independently.
 *
 * Usage:
 *   pnpm tsx src/test/e2e/fund-accounts.ts
 *
 * Environment Variables:
 *   - SKIP_FUNDING=true: Check if already funded, skip if so
 *   - FUND_NETWORKS: Comma-separated list of networks (default: all)
 *   - TENDERLY_API_KEY: Required for Tenderly API access
 */

import { getTestAddresses, TEST_WALLET_COUNT } from './utils/testWallets';
import { getRpcUrlFromFile } from './utils/getRpcUrlFromFile';
import { NetworkName } from './utils/constants';
import { validateVnets } from './validate-vnets';
import {
  usdsAddress,
  usdcAddress,
  mcdDaiAddress,
  mkrAddress,
  skyAddress,
  wethAddress,
  sUsdsAddress,
  usdsL2Address,
  usdcL2Address,
  sUsdsL2Address
} from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { parseUnits, formatUnits } from 'viem';
import { base, arbitrum, optimism, unichain } from 'viem/chains';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Set ETH balances for multiple accounts using Tenderly's bulk API
 */
async function setEthBalancesInBulk(
  rpcUrl: string,
  addresses: string[],
  balance: string = '0x56BC75E2D63100000' // 100 ETH in wei
): Promise<void> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'tenderly_setBalance',
      params: [addresses, balance]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to set ETH balances: ${response.statusText} - ${text}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error setting ETH: ${result.error.message}`);
  }
}

/**
 * Set ERC20 token balances for multiple accounts using Tenderly's setErc20Balance
 */
async function setTokenBalancesInBulk(
  rpcUrl: string,
  tokenAddress: string,
  addresses: string[],
  amount: string,
  decimals: number
): Promise<void> {
  const balance = '0x' + parseUnits(amount, decimals).toString(16);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'tenderly_setErc20Balance',
      params: [tokenAddress, addresses, balance]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to set token balances for ${tokenAddress}: ${response.statusText} - ${text}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error setting token ${tokenAddress}: ${result.error.message}`);
  }
}

/**
 * Get balance of an account (ETH or ERC20)
 */
async function getBalance(rpcUrl: string, address: string, tokenAddress?: string): Promise<string> {
  let result;

  if (!tokenAddress) {
    // Get ETH balance
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    result = await response.json();
  } else {
    // Get ERC20 balance
    const balanceOfData = '0x70a08231' + address.slice(2).padStart(64, '0');
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: tokenAddress,
            data: balanceOfData
          },
          'latest'
        ]
      })
    });
    result = await response.json();
  }

  return result.result || '0x0';
}

/**
 * Log account balances for debugging
 */
async function logAccountBalances(
  network: NetworkName,
  rpcUrl: string,
  addresses: string[],
  tokens: { address: string; name: string; decimals: number }[]
): Promise<void> {
  console.log(`\n  📊 Sample account balances on ${network}:`);

  // Log first 2 accounts for brevity
  for (const address of addresses.slice(0, 2)) {
    console.log(`    Account ${address.slice(0, 10)}...:`);

    // Check ETH balance
    try {
      const ethBalance = await getBalance(rpcUrl, address);
      const ethFormatted = formatUnits(BigInt(ethBalance), 18);
      console.log(`      ETH: ${parseFloat(ethFormatted).toFixed(2)}`);
    } catch {
      console.log('      ETH: Error');
    }

    // Check token balances
    for (const token of tokens) {
      if (!token.address) continue;
      try {
        const balance = await getBalance(rpcUrl, address, token.address);
        const formatted = formatUnits(BigInt(balance), token.decimals);
        console.log(`      ${token.name}: ${parseFloat(formatted).toFixed(2)}`);
      } catch {
        // Token might not exist on this network
      }
    }
  }
}

/**
 * Get L2 chain ID for a network
 */
function getL2ChainId(network: NetworkName): number {
  switch (network) {
    case NetworkName.base:
      return base.id;
    case NetworkName.arbitrum:
      return arbitrum.id;
    case NetworkName.optimism:
      return optimism.id;
    case NetworkName.unichain:
      return unichain.id;
    default:
      return 0;
  }
}

/**
 * Check if accounts already have sufficient balances
 */
async function checkAccountsFunded(
  network: NetworkName,
  rpcUrl: string,
  addresses: string[]
): Promise<boolean> {
  try {
    // Check first account only (assumes all accounts are funded together)
    const firstAccount = addresses[0];

    // Check ETH balance
    const ethBalance = await getBalance(rpcUrl, firstAccount);
    const ethAmount = formatUnits(BigInt(ethBalance), 18);

    // If ETH balance is less than 10, assume accounts need funding
    if (parseFloat(ethAmount) < 10) {
      return false;
    }

    console.log(`  ⚡ Accounts already funded on ${network} (ETH: ${parseFloat(ethAmount).toFixed(2)})`);
    return true;
  } catch {
    // If we can't check, assume funding is needed
    return false;
  }
}

/**
 * Create a snapshot of the VNet state (after funding)
 */
async function createSnapshot(network: NetworkName): Promise<string> {
  const rpcUrl = await getRpcUrlFromFile(network);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'evm_snapshot',
      params: []
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Failed to create snapshot for ${network}: ${result.error.message}`);
  }

  console.log(`  📸 Created snapshot for ${network}: ${result.result}`);
  return result.result;
}

/**
 * Fund all test accounts on a specific VNet with ETH and common tokens
 */
async function fundAccountsOnVnet(network: NetworkName, addresses: string[]): Promise<void> {
  console.log(`\nFunding ${addresses.length} accounts on ${network}...`);

  try {
    const rpcUrl = await getRpcUrlFromFile(network);

    // Check if we should skip funding
    const skipFunding = process.env.SKIP_FUNDING === 'true';
    if (skipFunding) {
      const alreadyFunded = await checkAccountsFunded(network, rpcUrl, addresses);
      if (alreadyFunded) {
        console.log(`✓ Skipped funding ${network} (accounts already funded)`);
        return;
      }
      console.log(`  📡 Accounts need funding on ${network}, proceeding...`);
    }

    // Set ETH balance for all accounts in bulk
    await setEthBalancesInBulk(rpcUrl, addresses);
    console.log('  ✓ ETH funded');

    const tokensToLog: { address: string; name: string; decimals: number }[] = [];

    // Fund tokens based on network
    if (network === NetworkName.mainnet) {
      // Fund mainnet tokens in bulk
      const tokenFunding = [
        { token: usdsAddress[TENDERLY_CHAIN_ID], amount: '900', decimals: 18, name: 'USDS' },
        { token: mcdDaiAddress[TENDERLY_CHAIN_ID], amount: '900', decimals: 18, name: 'DAI' },
        { token: usdcAddress[TENDERLY_CHAIN_ID], amount: '900', decimals: 6, name: 'USDC' },
        { token: mkrAddress[TENDERLY_CHAIN_ID], amount: '900', decimals: 18, name: 'MKR' },
        { token: skyAddress[TENDERLY_CHAIN_ID], amount: '100000000', decimals: 18, name: 'SKY' },
        { token: wethAddress[TENDERLY_CHAIN_ID], amount: '900', decimals: 18, name: 'WETH' },
        { token: sUsdsAddress[TENDERLY_CHAIN_ID], amount: '900', decimals: 18, name: 'sUSDS' }
      ];

      for (const { token, amount, decimals, name } of tokenFunding) {
        if (token) {
          try {
            await setTokenBalancesInBulk(rpcUrl, token, addresses, amount, decimals);
            console.log(`  ✓ ${name} funded`);
            tokensToLog.push({ address: token, name, decimals });
          } catch (error) {
            console.warn(`  ⚠ Failed to fund ${name}: ${(error as Error).message}`);
          }
        }
      }
    } else {
      // Fund L2-specific tokens
      const chainId = getL2ChainId(network);
      if (chainId) {
        const l2TokenFunding = [
          {
            token: usdsL2Address[chainId as keyof typeof usdsL2Address],
            amount: '10000',
            decimals: 18,
            name: 'USDS'
          },
          {
            token: usdcL2Address[chainId as keyof typeof usdcL2Address],
            amount: '10000',
            decimals: 6,
            name: 'USDC'
          },
          {
            token: sUsdsL2Address[chainId as keyof typeof sUsdsL2Address],
            amount: '10000',
            decimals: 18,
            name: 'sUSDS'
          },
          {
            token: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
            amount: '10000',
            decimals: 18,
            name: 'DAI'
          }
        ];

        for (const { token, amount, decimals, name } of l2TokenFunding) {
          if (token) {
            try {
              await setTokenBalancesInBulk(rpcUrl, token, addresses, amount, decimals);
              console.log(`  ✓ ${name} funded on ${network}`);
              tokensToLog.push({ address: token, name, decimals });
            } catch (error) {
              console.warn(`  ⚠ Failed to fund ${name} on ${network}: ${(error as Error).message}`);
            }
          }
        }
      }
    }

    // Log sample account balances
    await logAccountBalances(network, rpcUrl, addresses, tokensToLog);

    console.log(`✓ Funded ${addresses.length} accounts on ${network}`);
  } catch (error) {
    console.error(`Failed to fund accounts on ${network}:`, error);
    throw error;
  }
}

/**
 * Main funding script
 */
async function main() {
  console.log('=== Funding Test Accounts ===\n');

  try {
    // Step 1: Validate VNets (skip balance check since we're about to fund them)
    console.log('1. Validating VNets (checking connectivity, not balances)...');
    const validationResult = await validateVnets(true); // skipBalanceCheck = true

    if (!validationResult.healthy) {
      console.error('❌ VNet validation failed!');
      console.error('Please ensure VNets are created using: pnpm vnet:fork:ci');

      // Check if VNets are expired/deleted
      const vnetNotFound = validationResult.results.some(r =>
        r.errors.some(e => e.includes('not accessible') || e.includes('not found'))
      );

      if (vnetNotFound) {
        console.error('⚠️  VNets appear to be expired/deleted');
        console.error('💡 Run: pnpm vnet:fork:ci');
      }

      process.exit(1);
    }

    console.log('✅ VNets validated (connectivity OK)\n');

    // Step 2: Generate test addresses
    console.log('2. Generating test addresses...');
    const addresses = getTestAddresses(TEST_WALLET_COUNT);
    console.log(`Generated ${addresses.length} test addresses`);
    console.log('Sample addresses:');
    addresses.slice(0, 3).forEach((addr, i) => {
      console.log(`  [${i}]: ${addr}`);
    });
    console.log(`  ... (${addresses.length - 3} more addresses)\n`);

    // Step 3: Determine which networks to fund
    const targetNetworks = process.env.FUND_NETWORKS || process.env.TEST_NETWORKS;
    let networks: NetworkName[];

    if (targetNetworks) {
      const requestedNetworks = targetNetworks.split(',').map(n => n.trim().toLowerCase());
      networks = requestedNetworks
        .map(n => {
          switch (n) {
            case 'mainnet':
              return NetworkName.mainnet;
            case 'base':
              return NetworkName.base;
            case 'arbitrum':
              return NetworkName.arbitrum;
            case 'optimism':
              return NetworkName.optimism;
            case 'unichain':
              return NetworkName.unichain;
            default:
              console.warn(`Unknown network: ${n}, skipping...`);
              return null;
          }
        })
        .filter(n => n !== null) as NetworkName[];

      console.log(`3. Funding specified networks: ${networks.join(', ')}\n`);
    } else {
      networks = [
        NetworkName.mainnet,
        NetworkName.base,
        NetworkName.arbitrum,
        NetworkName.optimism,
        NetworkName.unichain
      ];
      console.log('3. Funding all networks\n');
    }

    // Step 4: Fund accounts on all networks
    const fundingPromises = networks.map(network => fundAccountsOnVnet(network, addresses));
    await Promise.all(fundingPromises);

    // Step 5: Create snapshots after funding
    console.log('\n4. Creating VNet snapshots after funding...');
    const snapshotPromises = networks.map(async network => {
      const snapshotId = await createSnapshot(network);
      return { network, snapshotId };
    });
    const snapshots = await Promise.all(snapshotPromises);

    // Step 6: Save snapshots to file
    const snapshotFile = path.join(__dirname, 'persistent-vnet-snapshots.json');
    const snapshotData = Object.fromEntries(snapshots.map(s => [s.network, s.snapshotId]));
    await fs.writeFile(snapshotFile, JSON.stringify(snapshotData, null, 2));
    console.log(`\n✅ Snapshots saved to ${snapshotFile}`);
    console.log('💡 These snapshots will be used for instant test setup!\n');

    console.log('=== Funding Complete ===');
    console.log(`✅ Funded ${addresses.length} accounts on ${networks.length} networks`);
    console.log(`✅ Created ${snapshots.length} snapshots`);
    console.log('\nYou can now run tests with instant setup:');
    console.log('  pnpm e2e');
    console.log('  or');
    console.log('  pnpm playwright test --config=playwright-parallel.config.ts');
  } catch (error) {
    console.error('\n❌ Funding failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
