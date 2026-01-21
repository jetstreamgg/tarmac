import { promises as fs } from 'fs';
import * as path from 'path';
import { getTestWalletAddress, TEST_WALLET_COUNT } from './testWallets';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { NetworkName } from './constants';

/**
 * Account pool manager for parallel test execution.
 * Provides atomic account allocation and deallocation across multiple workers.
 */

// interface AccountPoolState {
//   available: number[];           // Pool of available account indices
//   inUse: Map<number, string>;   // Map of account index to holder identifier
//   lastUpdated: number;           // Timestamp for debugging
// }

interface PoolFileState {
  available: number[];
  inUse: { [key: string]: string };
  lastUpdated: number;
  shardInfo?: {
    index: number;
    total: number;
    startIndex: number;
    endIndex: number;
  };
}

export class AccountPoolManager {
  private readonly lockFilePath: string;
  private readonly lockTimeout = 30000; // 30 seconds timeout for stuck accounts
  private readonly maxRetries = 10;
  private readonly retryDelay = 100; // ms

  constructor(lockFilePath?: string) {
    // Detect shard mode and use shard-specific pool file
    const shardIndex = process.env.PLAYWRIGHT_SHARD_INDEX;
    const totalShards = process.env.PLAYWRIGHT_SHARD_TOTAL;
    const isSharded = totalShards && parseInt(totalShards) > 1;

    const suffix = isSharded ? `-shard-${shardIndex}` : '';
    this.lockFilePath = lockFilePath || path.join(process.cwd(), 'tmp', `test-account-pool${suffix}.json`);
  }

  /**
   * Initialize the account pool with all available accounts
   */
  async initialize(accountCount: number = TEST_WALLET_COUNT): Promise<void> {
    const dir = path.dirname(this.lockFilePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Create initial state with all accounts available
    const initialState: PoolFileState = {
      available: Array.from({ length: accountCount }, (_, i) => i),
      inUse: {},
      lastUpdated: Date.now()
    };

    await this.writeState(initialState);
    console.log(`Account pool initialized with ${accountCount} accounts`);
  }

  /**
   * Initialize the account pool with a partition of accounts (for sharding)
   */
  async initializePartition(startIndex: number, endIndex: number): Promise<void> {
    const dir = path.dirname(this.lockFilePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Get shard info from environment
    const shardIndex = process.env.PLAYWRIGHT_SHARD_INDEX
      ? parseInt(process.env.PLAYWRIGHT_SHARD_INDEX) - 1
      : 0;
    const totalShards = process.env.PLAYWRIGHT_SHARD_TOTAL ? parseInt(process.env.PLAYWRIGHT_SHARD_TOTAL) : 1;

    // Create initial state with only this shard's account partition
    const accountIndices = Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i);

    const initialState: PoolFileState = {
      available: accountIndices,
      inUse: {},
      lastUpdated: Date.now(),
      shardInfo: {
        index: shardIndex,
        total: totalShards,
        startIndex,
        endIndex
      }
    };

    await this.writeState(initialState);
    console.log(
      `Account pool initialized with partition [${startIndex}:${endIndex}) - ${accountIndices.length} accounts for shard ${shardIndex + 1}/${totalShards}`
    );
  }

  /**
   * Atomically claim the next available account from the pool
   */
  async claimAccount(holderId: string): Promise<number> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      let lockAcquired = false;

      try {
        // Acquire lock before reading and writing
        await this.acquireLock();
        lockAcquired = true;

        const state = await this.readState();

        // DISABLED: Don't clean up timed-out accounts to ensure no account reuse
        // this.cleanupTimedOutAccounts(state);

        if (state.available.length === 0) {
          // No accounts available - release lock and retry
          await this.releaseLock();
          lockAcquired = false;

          console.log(
            `⏳ No accounts available for ${holderId}, retrying... (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await this.delay(this.retryDelay * 2);
          continue;
        }

        // Check if account is already in use (safety check)
        const accountIndex = state.available.shift()!;
        if (state.inUse[accountIndex.toString()]) {
          throw new Error(
            `CRITICAL: Account ${accountIndex} already in use by ${state.inUse[accountIndex.toString()]} but was in available array!`
          );
        }

        state.inUse[accountIndex.toString()] = `${holderId}-${Date.now()}`;
        state.lastUpdated = Date.now();

        console.log(`🔒 About to claim account ${accountIndex} for ${holderId}`);
        console.log(
          `📊 Pool state: ${state.available.length} available, ${Object.keys(state.inUse).length} in use`
        );

        // Write the updated state (lock is already held)
        const tmpPath = `${this.lockFilePath}.tmp.${holderId}.${Date.now()}.${Math.random()}`;
        await fs.writeFile(tmpPath, JSON.stringify(state, null, 2));
        await fs.rename(tmpPath, this.lockFilePath);

        // Release lock before returning
        await this.releaseLock();
        lockAcquired = false;

        console.log(`✅ Account ${accountIndex} claimed by ${holderId}`);
        return accountIndex;
      } catch (error) {
        // Release lock if we still hold it
        if (lockAcquired) {
          try {
            await this.releaseLock();
          } catch (releaseError) {
            console.log(`⚠️ Error releasing lock during error handling: ${releaseError}`);
          }
        }

        // Retry on any error
        if (attempt === this.maxRetries - 1) {
          throw new Error(`Failed to claim account after ${this.maxRetries} attempts: ${error}`);
        }
        await this.delay(this.retryDelay);
      }
    }

    throw new Error('Failed to claim account: max retries exceeded');
  }

  /**
   * Release an account back to the pool
   */
  async releaseAccount(accountIndex: number, holderId: string): Promise<void> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Acquire lock before reading and writing
        await this.acquireLock();

        try {
          const state = await this.readState();

          // Verify the holder is releasing their own account
          const currentHolder = state.inUse[accountIndex.toString()];
          if (currentHolder && !currentHolder.startsWith(holderId)) {
            console.warn(
              `Account ${accountIndex} is held by ${currentHolder}, not ${holderId}. Releasing anyway.`
            );
            // Still proceed with release - the account might be stuck
          }

          // Check if account is already available
          if (!currentHolder && state.available.includes(accountIndex)) {
            console.log(`Account ${accountIndex} already available, skipping release`);
            return;
          }

          // Remove from inUse and add back to available
          delete state.inUse[accountIndex.toString()];
          if (!state.available.includes(accountIndex)) {
            state.available.push(accountIndex);
            state.available.sort((a, b) => a - b); // Keep sorted for predictability
          }
          state.lastUpdated = Date.now();

          // Write the updated state (lock is already held)
          const tmpPath = `${this.lockFilePath}.tmp.${Date.now()}`;
          await fs.writeFile(tmpPath, JSON.stringify(state, null, 2));
          await fs.rename(tmpPath, this.lockFilePath);

          console.log(`Account ${accountIndex} released by ${holderId}`);
          return;
        } finally {
          await this.releaseLock();
        }
      } catch (error) {
        if (attempt === this.maxRetries - 1) {
          console.error(`Failed to release account after ${this.maxRetries} attempts: ${error}`);
          // Don't throw - we don't want to fail tests because of pool management
          return;
        }
        await this.delay(this.retryDelay);
      }
    }
  }

  /**
   * Get the current state of the account pool (for debugging)
   */
  async getPoolStatus(): Promise<{ available: number; inUse: number; total: number }> {
    const state = await this.readState();
    return {
      available: state.available.length,
      inUse: Object.keys(state.inUse).length,
      total: state.available.length + Object.keys(state.inUse).length
    };
  }

  /**
   * Force cleanup - releases all accounts (use with caution)
   */
  async reset(): Promise<void> {
    await this.initialize();
  }

  /**
   * Get the wallet address for an account index
   */
  getAccountAddress(accountIndex: number): `0x${string}` {
    return getTestWalletAddress(accountIndex).toLowerCase() as `0x${string}`;
  }

  /**
   * Initialize an account with a small self-transfer to establish it on-chain
   * Can be called by tests that need account initialization
   */
  async initializeAccount(address: `0x${string}`): Promise<void> {
    // Track initialized accounts to avoid re-initialization
    const initializedFile = `${this.lockFilePath}.initialized`;
    let initialized: Set<string>;

    try {
      const data = await fs.readFile(initializedFile, 'utf-8');
      initialized = new Set(JSON.parse(data));
    } catch {
      initialized = new Set();
    }

    if (initialized.has(address)) {
      console.log(`  ✓ Account ${address} already initialized`);
      return;
    }

    console.log(`  🔄 Initializing account ${address} with self-transfer...`);

    try {
      // Get RPC URL for mainnet
      const rpcUrl = await this.getRpcUrl();
      if (!rpcUrl) {
        console.warn('  ⚠ No RPC URL available, skipping initialization');
        return;
      }

      // Send a tiny self-transfer to initialize the account
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 1,
          jsonrpc: '2.0',
          method: 'eth_sendTransaction',
          params: [
            {
              from: address,
              to: address,
              value: '0x1', // 1 wei
              gas: '0x5208' // 21000 gas for simple transfer
            }
          ]
        })
      });

      const result = await response.json();
      if (result.error) {
        console.warn(`  ⚠ Failed to initialize account: ${result.error.message}`);
      } else {
        console.log(`  ✓ Account initialized with tx: ${result.result}`);

        // Mark as initialized
        initialized.add(address);
        await fs.writeFile(initializedFile, JSON.stringify(Array.from(initialized)));
      }
    } catch (error) {
      console.warn(`  ⚠ Error initializing account: ${(error as Error).message}`);
    }
  }

  /**
   * Get RPC URL from file (reusing logic from global setup)
   */
  private async getRpcUrl(): Promise<string | null> {
    try {
      return await getRpcUrlFromFile(NetworkName.mainnet);
    } catch {
      return null;
    }
  }

  // Private helper methods

  private async readState(): Promise<PoolFileState> {
    try {
      const content = await fs.readFile(this.lockFilePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // File doesn't exist, return empty state
      return {
        available: [],
        inUse: {},
        lastUpdated: Date.now()
      };
    }
  }

  private async acquireLock(): Promise<void> {
    const lockDir = `${this.lockFilePath}.lock`;
    const maxAttempts = 100; // 10 seconds max wait

    for (let i = 0; i < maxAttempts; i++) {
      try {
        // mkdir is atomic - only one process can succeed
        await fs.mkdir(lockDir);
        console.log(`🔐 Lock acquired: ${lockDir}`);
        return; // Lock acquired
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock exists, wait and retry
          console.log(`⏳ Lock exists, waiting... (attempt ${i + 1}/${maxAttempts})`);
          await this.delay(100);
        } else {
          throw error;
        }
      }
    }

    // Force remove stale lock after 10 seconds
    console.warn('Force removing stale lock after timeout');
    try {
      await fs.rmdir(lockDir);
    } catch {
      // Ignore error when removing stale lock
    }

    // Try once more
    await fs.mkdir(lockDir);
  }

  private async releaseLock(): Promise<void> {
    const lockDir = `${this.lockFilePath}.lock`;
    try {
      await fs.rmdir(lockDir);
      console.log(`🔓 Lock released: ${lockDir}`);
    } catch (error) {
      console.log(`⚠️ Failed to release lock ${lockDir}:`, error);
    }
  }

  private async writeState(state: PoolFileState): Promise<void> {
    await this.acquireLock();

    try {
      const tmpPath = `${this.lockFilePath}.tmp.${Date.now()}`;

      // Write to temp file first (atomic write pattern)
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 2));

      // Rename is atomic on most filesystems
      await fs.rename(tmpPath, this.lockFilePath);
    } finally {
      await this.releaseLock();
    }
  }

  private cleanupTimedOutAccounts(state: PoolFileState): void {
    const now = Date.now();
    const timedOut: number[] = [];

    for (const [indexStr, holderInfo] of Object.entries(state.inUse)) {
      const timestamp = parseInt(holderInfo.split('-').pop() || '0');
      if (now - timestamp > this.lockTimeout) {
        timedOut.push(parseInt(indexStr));
        console.warn(`Account ${indexStr} timed out, releasing from ${holderInfo}`);
      }
    }

    // Release timed out accounts
    for (const index of timedOut) {
      delete state.inUse[index.toString()];
      if (!state.available.includes(index)) {
        state.available.push(index);
      }
    }

    if (timedOut.length > 0) {
      state.available.sort((a, b) => a - b);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for easy access
export const accountPool = new AccountPoolManager();
