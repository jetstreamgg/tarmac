import { accountPool } from './utils/accountPoolManager';
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
 * Global setup for parallel test execution.
 * Initializes the account pool and pre-funds all test accounts on all vnets.
 */

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
  // Convert amount to wei/smallest unit
  const balance = '0x' + parseUnits(amount, decimals).toString(16);

  // Tenderly supports bulk token balance setting
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

  // With 100 accounts, only log first 2 for brevity
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
 * Revert a VNet to a previous snapshot
 */
async function revertToSnapshot(network: NetworkName, snapshotId: string): Promise<void> {
  const rpcUrl = await getRpcUrlFromFile(network);

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'evm_revert',
      params: [snapshotId]
    })
  });

  const result = await response.json();
  if (result.error) {
    throw new Error(`Failed to revert snapshot for ${network}: ${result.error.message}`);
  }

  console.log(`  ⏮️  Reverted ${network} to snapshot: ${snapshotId}`);
}

/**
 * Pre-fund all test accounts on a specific vnet with ETH and common tokens
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

      // Fund each token type in bulk
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
 * Detect if we're running in shard mode
 */
function detectShardMode(): { isSharded: boolean; shardIndex: number; totalShards: number } {
  const totalShards = process.env.PLAYWRIGHT_SHARD_TOTAL ? parseInt(process.env.PLAYWRIGHT_SHARD_TOTAL) : 1;
  const shardIndex = process.env.PLAYWRIGHT_SHARD_INDEX
    ? parseInt(process.env.PLAYWRIGHT_SHARD_INDEX) - 1 // Convert to 0-based
    : 0;

  const isSharded = totalShards > 1;

  return { isSharded, shardIndex, totalShards };
}

/**
 * Standard setup for non-sharded execution (current behavior)
 */
async function standardSetup(): Promise<void> {
  console.log('\n2. Initializing account pool with all addresses...');
  await accountPool.initialize(TEST_WALLET_COUNT);
  console.log(`Account pool initialized with ${TEST_WALLET_COUNT} addresses`);
}

/**
 * Sharded setup with coordination between shards
 */
async function shardedSetup(addresses: string[], shardIndex: number, totalShards: number): Promise<void> {
  console.log(`\n2. Running in SHARD MODE (Shard ${shardIndex + 1}/${totalShards})`);

  // Calculate account partition for this shard
  const totalAccounts = TEST_WALLET_COUNT;
  const basePerShard = Math.floor(totalAccounts / totalShards);
  const remainder = totalAccounts % totalShards;
  const extra = shardIndex < remainder ? 1 : 0;
  const startIndex = shardIndex * basePerShard + Math.min(shardIndex, remainder);
  const partitionSize = basePerShard + extra;

  if (partitionSize === 0) {
    throw new Error(
      `Shard ${shardIndex + 1}/${totalShards} has no account allocation. Increase TEST_WALLET_COUNT or reduce total shards.`
    );
  }

  const endIndex = Math.min(startIndex + partitionSize, totalAccounts);

  console.log(
    `   This shard will use accounts ${startIndex}-${endIndex - 1} (${endIndex - startIndex} accounts)`
  );

  // Initialize account pool with only this shard's partition
  await accountPool.initializePartition(startIndex, endIndex);
  console.log(`   Account pool initialized with partition [${startIndex}:${endIndex})`);
}

export default async function globalSetup() {
  console.log('=== Global Setup for Parallel Tests ===');

  try {
    // Detect if we're running alternate VNet tests based on command or project filter
    const projectArg = process.argv.find(arg => arg.includes('--project'));
    const isAlternateProject = projectArg?.includes('chromium-alternate');

    // Set environment variable for alternate VNet selection
    if (isAlternateProject) {
      process.env.USE_ALTERNATE_VNET = 'true';
      console.log('🔵 Running alternate VNet tests - using alternate fork');
    } else {
      console.log('🔵 Running standard tests - using regular VNet fork');
    }

    // Detect shard mode
    const { isSharded, shardIndex, totalShards } = detectShardMode();

    if (isSharded) {
      console.log(`🔀 SHARD MODE DETECTED: Running as shard ${shardIndex + 1} of ${totalShards}`);
    } else {
      console.log('📦 WORKER MODE: Running with standard worker-based parallelism');
    }

    // Step 1: Generate all test addresses (100 addresses for the pool)
    console.log('\n1. Generating test addresses...');
    const addresses = getTestAddresses(TEST_WALLET_COUNT);
    console.log(`Generated ${addresses.length} test addresses for the pool`);
    console.log('Sample addresses:');
    addresses.slice(0, 3).forEach((addr, i) => {
      console.log(`  [${i}]: ${addr}`);
    });
    console.log(`  ... (${addresses.length - 3} more addresses)`);

    // Step 2: Initialize account pool based on mode
    if (isSharded) {
      await shardedSetup(addresses, shardIndex, totalShards);
    } else {
      await standardSetup();
    }

    // Step 3: Check for existing snapshots and validate them
    const snapshotFileName = isAlternateProject
      ? 'persistent-vnet-snapshots-alternate.json'
      : 'persistent-vnet-snapshots.json';
    const snapshotFile = path.join(__dirname, snapshotFileName);
    let existingSnapshots: Record<string, string> | null = null;

    try {
      const snapshotData = await fs.readFile(snapshotFile, 'utf-8');
      existingSnapshots = JSON.parse(snapshotData);
      console.log('\n3. ✅ Found existing VNet snapshots!');
      console.log('   Snapshots:', existingSnapshots ? Object.keys(existingSnapshots).join(', ') : 'none');

      // Validate snapshots before using them
      console.log('\n   🔍 Validating snapshots...');
      const validationResult = await validateVnets();

      if (validationResult.healthy) {
        console.log('   ✅ All snapshots valid - will revert to snapshots');
      } else {
        console.log('   ❌ Validation failed - will recreate snapshots by funding accounts');

        // Check if validation failed due to VNet not found (expired/deleted)
        const vnetNotFound = validationResult.results.some(r =>
          r.errors.some(e => e.includes('not accessible') || e.includes('not found'))
        );

        if (vnetNotFound) {
          console.log('   ⚠️  VNets appear to be expired/deleted - clearing cache files');
          try {
            // Delete both cache files to force VNet recreation
            await fs
              .unlink(path.join(__dirname, '..', '..', '..', 'tenderlyTestnetData.json'))
              .catch(() => {});
            await fs.unlink(snapshotFile).catch(() => {});
            console.log('   🗑️  Deleted stale VNet cache files');
            console.log('   💡 You need to recreate VNets using: pnpm vnet:fork:ci');
            throw new Error('VNets expired - please recreate them with: pnpm vnet:fork:ci');
          } catch (error) {
            if (error instanceof Error && error.message.includes('VNets expired')) {
              throw error;
            }
          }
        }

        existingSnapshots = null; // Force refunding
      }
    } catch {
      console.log('\n3. No existing snapshots found - will fund accounts and create snapshots');
    }

    // Step 4: Determine which networks to work with

    // Check if we should only fund specific networks (for debugging/development)
    const targetNetworks = process.env.FUND_NETWORKS || process.env.TEST_NETWORKS;
    let networks: NetworkName[];

    if (targetNetworks) {
      // Parse comma-separated list of networks
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

      console.log(`Funding only specified networks: ${networks.join(', ')}`);
    } else {
      // Default: fund all networks
      networks = [
        NetworkName.mainnet,
        NetworkName.base,
        NetworkName.arbitrum,
        NetworkName.optimism,
        NetworkName.unichain
      ];
      console.log('Funding all networks (use FUND_NETWORKS env to limit)');
    }

    // If snapshots exist, revert to them instead of funding
    if (existingSnapshots) {
      console.log('\n5. Reverting VNets to snapshots (restoring funded state)...');
      const snapshots = existingSnapshots; // Store in const for TypeScript
      const revertPromises = networks.map(network => {
        const snapshotId = snapshots[network];
        if (snapshotId) {
          return revertToSnapshot(network, snapshotId);
        }
        return Promise.resolve();
      });
      await Promise.all(revertPromises);
      console.log('✅ All VNets reverted to funded state - ready for tests!');
    } else {
      // No snapshots - need to fund and create snapshots
      // In shard mode, only shard 1 should fund; others should wait
      if (isSharded && shardIndex > 0) {
        console.log(`\n⏳ Shard ${shardIndex + 1} waiting for shard 1 to fund accounts...`);
        console.log('   💡 TIP: In CI, the setup job should fund accounts before shards run.');
        console.log('   💡 For local testing, run shard 1 first to fund accounts.');

        // Wait for snapshots to be created by shard 1
        const maxWaitTime = 600000; // 10 minutes
        const checkInterval = 5000; // 5 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
          try {
            const snapshotData = await fs.readFile(snapshotFile, 'utf-8');
            const snapshots = JSON.parse(snapshotData);
            if (snapshots && Object.keys(snapshots).length > 0) {
              console.log('   ✅ Snapshots created by shard 1! Reverting to them...');
              existingSnapshots = snapshots;

              const revertPromises = networks.map(network => {
                const snapshotId = existingSnapshots![network];
                if (snapshotId) {
                  return revertToSnapshot(network, snapshotId);
                }
                return Promise.resolve();
              });
              await Promise.all(revertPromises);
              break;
            }
          } catch {
            // Snapshot file doesn't exist yet, keep waiting
          }

          await new Promise(resolve => setTimeout(resolve, checkInterval));
          process.stdout.write('.');
        }

        if (!existingSnapshots) {
          throw new Error(
            'Timeout waiting for shard 1 to fund accounts. Please run shard 1 first or use the CI workflow.'
          );
        }
      } else {
        // Worker mode OR shard 1: do the funding
        if (isSharded) {
          console.log(`\n💰 Shard 1 funding all ${addresses.length} accounts (other shards will wait)...`);
        } else {
          console.log('\n5. Pre-funding accounts on vnets...');
        }

        const fundingPromises = networks.map(network => fundAccountsOnVnet(network, addresses));
        await Promise.all(fundingPromises);

        // Increase Seal debt ceiling on mainnet to allow staking tests to borrow
        if (networks.includes(NetworkName.mainnet)) {
          console.log('\n5.5. Increasing Seal debt ceiling...');
          try {
            const { updateSealDebtCeiling } = await import('./utils/updateSealDebtCeiling');
            // Set to 1 billion USDS in RAD format:
            // 1 billion * 1e45 = 1e54 (RAD has 45 decimals, converts to 1e27 WAD = 1 billion * 1e18)
            await updateSealDebtCeiling(BigInt('1000000000000000000000000000000000000000000000000000000'));
            console.log('✅ Seal debt ceiling increased to 1B USDS');
          } catch (error) {
            console.warn('⚠️  Failed to increase debt ceiling:', (error as Error).message);
            console.warn('   Staking tests may fail due to insufficient borrow capacity');
          }
        }

        // Create snapshots after funding (for next run)
        console.log('\n6. Creating VNet snapshots after funding...');
        const snapshotPromises = networks.map(async network => {
          const snapshotId = await createSnapshot(network);
          return { network, snapshotId };
        });
        const snapshots = await Promise.all(snapshotPromises);

        // Save snapshots to file for next run
        const snapshotData = Object.fromEntries(snapshots.map(s => [s.network, s.snapshotId]));
        await fs.writeFile(snapshotFile, JSON.stringify(snapshotData, null, 2));
        console.log(`✅ Snapshots saved to ${snapshotFile}`);
        console.log('💡 These snapshots will be used for all future test runs (instant setup!)');
      }
    }

    // Step 7: Display pool status
    const status = await accountPool.getPoolStatus();
    console.log('\n7. Account pool status:');
    console.log(`   - Available: ${status.available}`);
    console.log(`   - In use: ${status.inUse}`);
    console.log(`   - Total: ${status.total}`);

    console.log('\n=== Global Setup Complete ===\n');
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}

// Support for cleanup if needed
export async function globalTeardown() {
  console.log('=== Global Teardown ===');

  try {
    // Step 1: Revert all VNets to snapshots (for next test run)
    console.log('\n1. Reverting VNets to snapshots...');

    // Detect if we're running alternate VNet tests
    const projectArg = process.argv.find(arg => arg.includes('--project'));
    const isAlternateProject =
      projectArg?.includes('chromium-alternate') || process.env.USE_ALTERNATE_VNET === 'true';
    const snapshotFileName = isAlternateProject
      ? 'persistent-vnet-snapshots-alternate.json'
      : 'persistent-vnet-snapshots.json';
    const snapshotFile = path.join(__dirname, snapshotFileName);

    try {
      const snapshotData = await fs.readFile(snapshotFile, 'utf-8');
      const snapshots = JSON.parse(snapshotData);

      const revertPromises = Object.entries(snapshots).map(([network, snapshotId]) =>
        revertToSnapshot(network as NetworkName, snapshotId as string)
      );

      await Promise.all(revertPromises);
      console.log('✅ All VNets reverted to clean snapshots');
      console.log('🎉 VNets are ready for next test run (no funding needed)!');
    } catch (error) {
      console.log('ℹ️  No snapshots to revert (first run or snapshots not created)', error);
    }

    // Step 2: Reset the account pool to clean state
    await accountPool.reset();
    console.log('Account pool reset');

    console.log('\n=== Global Teardown Complete ===');
  } catch (error) {
    console.error('Global teardown failed:', error);
  }
}
