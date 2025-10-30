/**
 * Manually revert VNets to snapshots
 * Used before retry runs to get a clean state
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRpcUrlFromFile } from './utils/getRpcUrlFromFile';
import { NetworkName } from './utils/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function main() {
  console.log('🔄 Reverting VNets to snapshots...');

  const snapshotFile = path.join(__dirname, 'persistent-vnet-snapshots.json');

  try {
    const snapshotData = await fs.readFile(snapshotFile, 'utf-8');
    const snapshots = JSON.parse(snapshotData);

    const revertPromises = Object.entries(snapshots).map(([network, snapshotId]) =>
      revertToSnapshot(network as NetworkName, snapshotId as string)
    );

    await Promise.all(revertPromises);
    console.log('✅ All VNets reverted to clean snapshots');
    console.log('🎯 VNets ready for retry run with fresh accounts!');
  } catch (error) {
    console.error('❌ Failed to revert snapshots:', error);
    console.log("ℹ️  This is OK if snapshots don't exist yet");
    process.exit(0); // Don't fail - just skip if no snapshots
  }
}

main();
