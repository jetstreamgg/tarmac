#!/usr/bin/env tsx
/**
 * Standalone script to fund a single account on Tenderly VNets.
 * This script is useful for funding a specific address for testing.
 *
 * Usage:
 *   pnpm tsx src/test/e2e/fund-single-account.ts <address> [network]
 *
 * Examples:
 *   pnpm tsx src/test/e2e/fund-single-account.ts 0x1234...5678
 *   pnpm tsx src/test/e2e/fund-single-account.ts 0x1234...5678 mainnet
 *   pnpm tsx src/test/e2e/fund-single-account.ts 0x1234...5678 base,arbitrum
 *
 * Environment Variables:
 *   - TENDERLY_API_KEY: Required for Tenderly API access
 */

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
import { parseUnits, formatUnits, isAddress } from 'viem';
import { base, arbitrum, optimism, unichain } from 'viem/chains';

/**
 * Set ETH balance for a single account
 */
async function setEthBalance(
  rpcUrl: string,
  address: string,
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
      params: [[address], balance]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to set ETH balance: ${response.statusText} - ${text}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC error setting ETH: ${result.error.message}`);
  }
}

/**
 * Set ERC20 token balance for a single account
 */
async function setTokenBalance(
  rpcUrl: string,
  tokenAddress: string,
  address: string,
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
      params: [tokenAddress, [address], balance]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to set token balance for ${tokenAddress}: ${response.statusText} - ${text}`);
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
async function logAccountBalance(
  network: NetworkName,
  rpcUrl: string,
  address: string,
  tokens: { address: string; name: string; decimals: number }[]
): Promise<void> {
  console.log(`\n  📊 Account balances on ${network}:`);
  console.log(`    Account ${address}:`);

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
 * Fund a single account on a specific VNet with ETH and common tokens
 */
async function fundAccountOnVnet(network: NetworkName, address: string): Promise<void> {
  console.log(`\nFunding account ${address} on ${network}...`);

  try {
    const rpcUrl = await getRpcUrlFromFile(network);

    // Set ETH balance
    await setEthBalance(rpcUrl, address);
    console.log('  ✓ ETH funded');

    const tokensToLog: { address: string; name: string; decimals: number }[] = [];

    // Fund tokens based on network
    if (network === NetworkName.mainnet) {
      // Fund mainnet tokens
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
            await setTokenBalance(rpcUrl, token, address, amount, decimals);
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
              await setTokenBalance(rpcUrl, token, address, amount, decimals);
              console.log(`  ✓ ${name} funded on ${network}`);
              tokensToLog.push({ address: token, name, decimals });
            } catch (error) {
              console.warn(`  ⚠ Failed to fund ${name} on ${network}: ${(error as Error).message}`);
            }
          }
        }
      }
    }

    // Log account balances
    await logAccountBalance(network, rpcUrl, address, tokensToLog);

    console.log(`✓ Funded account ${address} on ${network}`);
  } catch (error) {
    console.error(`Failed to fund account on ${network}:`, error);
    throw error;
  }
}

/**
 * Main funding script
 */
async function main() {
  console.log('=== Funding Single Account ===\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Error: Address argument is required\n');
    console.log('Usage:');
    console.log('  pnpm tsx src/test/e2e/fund-single-account.ts <address> [network]\n');
    console.log('Examples:');
    console.log('  pnpm tsx src/test/e2e/fund-single-account.ts 0x1234...5678');
    console.log('  pnpm tsx src/test/e2e/fund-single-account.ts 0x1234...5678 mainnet');
    console.log('  pnpm tsx src/test/e2e/fund-single-account.ts 0x1234...5678 base,arbitrum');
    process.exit(1);
  }

  const address = args[0];
  const networkArg = args[1];

  // Validate address
  if (!isAddress(address)) {
    console.error(`❌ Error: Invalid Ethereum address: ${address}`);
    process.exit(1);
  }

  console.log(`Address: ${address}`);

  try {
    // Step 1: Basic VNet connectivity check (skip snapshot validation for single account funding)
    console.log('\n1. Checking VNet connectivity...');
    const validationResult = await validateVnets(true); // skipBalanceCheck = true

    // For single account funding, we only care about connectivity, not snapshot validity
    const hasConnectivityIssues = validationResult.results.some(r =>
      r.errors.some(
        e => e.includes('not accessible') || e.includes('ECONNREFUSED') || e.includes('not found')
      )
    );

    if (hasConnectivityIssues) {
      console.error('❌ VNet connectivity failed!');
      console.error('Please ensure VNets are created using: pnpm vnet:fork:ci');
      process.exit(1);
    }

    console.log('✅ VNets are accessible\n');

    // Step 2: Determine which networks to fund
    let networks: NetworkName[];

    if (networkArg) {
      const requestedNetworks = networkArg.split(',').map(n => n.trim().toLowerCase());
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

      console.log(`2. Funding specified networks: ${networks.join(', ')}\n`);
    } else {
      networks = [
        NetworkName.mainnet,
        NetworkName.base,
        NetworkName.arbitrum,
        NetworkName.optimism,
        NetworkName.unichain
      ];
      console.log('2. Funding all networks\n');
    }

    // Step 3: Fund account on all networks
    const fundingPromises = networks.map(network => fundAccountOnVnet(network, address));
    await Promise.all(fundingPromises);

    console.log('\n=== Funding Complete ===');
    console.log(`✅ Funded account ${address} on ${networks.length} networks`);
    console.log('\nThe account is now ready for testing!');
  } catch (error) {
    console.error('\n❌ Funding failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
