#!/usr/bin/env node

/**
 * Cleans up the alternate VNets created for specialized testing.
 * Reads the VNet IDs from tenderlyTestnetData-alternate.json and deletes them.
 */

const { readFile } = require('fs/promises');

async function cleanupAlternateVNet() {
  const apiKey = process.env.TENDERLY_API_KEY;

  if (!apiKey) {
    console.error('❌ TENDERLY_API_KEY not found in environment');
    process.exit(1);
  }

  try {
    // Read VNet IDs from tenderlyTestnetData-alternate.json
    const data = await readFile('./tenderlyTestnetData-alternate.json', 'utf-8');
    const vnets = JSON.parse(data);

    if (!vnets || vnets.length === 0) {
      console.log('ℹ️  No VNets found in tenderlyTestnetData-alternate.json');
      return;
    }

    console.log(`🧹 Deleting ${vnets.length} Alternate VNets...`);

    // Delete all VNets
    for (const vnet of vnets) {
      const vnetId = vnet.TENDERLY_TESTNET_ID;
      const network = vnet.NETWORK;

      console.log(`   Deleting ${network} VNet: ${vnetId}...`);

      const response = await fetch(
        `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/${vnetId}`,
        {
          method: 'DELETE',
          headers: {
            'X-Access-Key': apiKey
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️  Failed to delete ${network}: ${response.status} - ${errorText}`);
      } else {
        console.log(`   ✅ ${network} deleted`);
      }
    }

    console.log('');
    console.log('✅ All Alternate VNets deleted successfully!');
    console.log('');
    console.log('💡 Note: This only deleted Alternate VNets (tenderlyTestnetData-alternate.json)');
    console.log('💡 Standard VNets (tenderlyTestnetData.json) are still intact');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupAlternateVNet();
