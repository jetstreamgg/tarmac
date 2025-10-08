import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VNet {
  id: string;
  chains: string[];
  inUse: boolean;
  createdAt: Date;
  lastUsed: Date;
}

class VNetPoolManager {
  private pools: Map<string, VNet[]> = new Map();
  private maxPoolSize = 3; // Max VNets per chain combination
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Periodic cleanup of unused VNets
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  private getPoolKey(chains: string[]): string {
    return chains.sort().join(',');
  }

  async acquireVNet(chains: string[]): Promise<string> {
    const key = this.getPoolKey(chains);
    const pool = this.pools.get(key) || [];

    // Find available VNet
    const available = pool.find(v => !v.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsed = new Date();
      console.log(`Reusing VNet ${available.id} for chains: ${chains.join(',')}`);
      return available.id;
    }

    // Create new VNet if under limit
    if (pool.length < this.maxPoolSize) {
      const vnetId = await this.createVNet(chains);
      const newVNet: VNet = {
        id: vnetId,
        chains,
        inUse: true,
        createdAt: new Date(),
        lastUsed: new Date()
      };
      pool.push(newVNet);
      this.pools.set(key, pool);
      console.log(`Created new VNet ${vnetId} for chains: ${chains.join(',')}`);
      return vnetId;
    }

    // Wait for available VNet if at limit
    console.log(`Waiting for available VNet for chains: ${chains.join(',')}`);
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const availableNow = pool.find(v => !v.inUse);
        if (availableNow) {
          clearInterval(checkInterval);
          availableNow.inUse = true;
          availableNow.lastUsed = new Date();
          resolve(availableNow.id);
        }
      }, 1000);
    });
  }

  async releaseVNet(vnetId: string): Promise<void> {
    for (const [, pool] of this.pools) {
      const vnet = pool.find(v => v.id === vnetId);
      if (vnet) {
        vnet.inUse = false;
        console.log(`Released VNet ${vnetId}`);
        // Reset snapshot for next use
        await this.resetVNetSnapshot(vnetId);
        return;
      }
    }
  }

  private async createVNet(chains: string[]): Promise<string> {
    const chainString = chains.join(',');
    const { stdout } = await execAsync(`node ./scripts/forkVnet.ts ${chainString}`, {
      env: { ...process.env, RETURN_ID_ONLY: 'true' }
    });
    return stdout.trim();
  }

  private async resetVNetSnapshot(vnetId: string): Promise<void> {
    try {
      await execAsync(`node ./scripts/resetVnetSnapshot.ts ${vnetId}`);
    } catch (error) {
      console.error(`Failed to reset snapshot for VNet ${vnetId}:`, error);
    }
  }

  private async deleteVNet(vnetId: string): Promise<void> {
    try {
      await execAsync(`node ./scripts/deleteVnet.ts ${vnetId}`);
    } catch (error) {
      console.error(`Failed to delete VNet ${vnetId}:`, error);
    }
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [key, pool] of this.pools) {
      const toDelete: VNet[] = [];

      for (const vnet of pool) {
        if (!vnet.inUse && now.getTime() - vnet.lastUsed.getTime() > maxAge) {
          toDelete.push(vnet);
        }
      }

      // Delete old unused VNets
      for (const vnet of toDelete) {
        await this.deleteVNet(vnet.id);
        const index = pool.indexOf(vnet);
        pool.splice(index, 1);
        console.log(`Cleaned up unused VNet ${vnet.id}`);
      }

      // Update pool
      if (pool.length === 0) {
        this.pools.delete(key);
      } else {
        this.pools.set(key, pool);
      }
    }
  }

  async teardown(): Promise<void> {
    // Delete all VNets on teardown
    for (const [, pool] of this.pools) {
      for (const vnet of pool) {
        await this.deleteVNet(vnet.id);
      }
    }
    this.pools.clear();
  }
}

// Export singleton instance
export const vnetPool = new VNetPoolManager();

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const chains = process.argv[3]?.split(',') || ['mainnet'];

  switch (command) {
    case 'acquire':
      vnetPool.acquireVNet(chains).then(id => {
        console.log(id);
        process.exit(0);
      });
      break;
    case 'release': {
      const vnetId = process.argv[3];
      vnetPool.releaseVNet(vnetId).then(() => {
        process.exit(0);
      });
      break;
    }
    case 'teardown':
      vnetPool.teardown().then(() => {
        process.exit(0);
      });
      break;
    default:
      console.log('Usage: vnetPoolManager.ts [acquire|release|teardown] [chains|vnetId]');
      process.exit(1);
  }
}
