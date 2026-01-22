#!/usr/bin/env node

/**
 * Creates VNets with an alternate mainnet fork for specialized testing.
 * This can be used when tests require a specific fork state (e.g., Curve pool configured).
 * Output: tenderlyTestnetData-alternate.json
 *
 * To use a different fork container, set ALTERNATE_FORK_CONTAINER_ID env var.
 */

require('dotenv').config();
const { writeFile } = require('fs/promises');

// Default alternate fork container (has Curve pool properly configured)
const DEFAULT_ALTERNATE_FORK_CONTAINER_ID = 'cec455a4-3a8a-4a93-ac66-fc98fa1a8103';
const ALTERNATE_FORK_CONTAINER_ID =
  process.env.ALTERNATE_FORK_CONTAINER_ID || DEFAULT_ALTERNATE_FORK_CONTAINER_ID;

const NETWORK_CONFIGS = {
  base: { chainId: 8453, forkBlock: '31758878' },
  arbitrum: { chainId: 42161, forkBlock: '343221023' },
  optimism: { chainId: 10, forkBlock: '136644925' },
  unichain: { chainId: 130, forkBlock: '18140271' }
};

async function createAlternateVNet() {
  const apiKey = process.env.TENDERLY_API_KEY;

  if (!apiKey) {
    console.error('❌ TENDERLY_API_KEY not found in environment');
    console.error('Make sure .env file exists with TENDERLY_API_KEY');
    process.exit(1);
  }

  console.log('🔧 Creating Alternate VNets for all networks...');
  console.log(`   - Mainnet: Using fork container ${ALTERNATE_FORK_CONTAINER_ID}`);
  console.log('   - Base, Arbitrum, Optimism, Unichain: Standard forks');
  console.log('');

  try {
    const currentTime = Date.now();
    const vnetData = [];

    // Create mainnet with alternate fork
    console.log('Creating mainnet VNet...');
    const mainnetResponse = await fetch(
      'https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/fork',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': apiKey
        },
        body: JSON.stringify({
          vnet_id: ALTERNATE_FORK_CONTAINER_ID,
          display_name: 'alternate-local-test-mainnet'
        })
      }
    );

    if (!mainnetResponse.ok) {
      const error = await mainnetResponse.text();
      throw new Error(`Failed to create mainnet VNet: ${mainnetResponse.status}\n${error}`);
    }

    const mainnetData = await mainnetResponse.json();
    const mainnetRpc = mainnetData.rpcs.find(r => r.name === 'Admin RPC');

    vnetData.push({
      NETWORK: 'mainnet',
      TENDERLY_TESTNET_ID: mainnetData.id,
      TENDERLY_RPC_URL: mainnetRpc.url
    });
    console.log(`✅ Mainnet: ${mainnetData.id}`);

    // Create other networks
    for (const [network, config] of Object.entries(NETWORK_CONFIGS)) {
      console.log(`Creating ${network} VNet...`);

      const response = await fetch(
        'https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Access-Key': apiKey
          },
          body: JSON.stringify({
            slug: `alternate-test-${config.chainId}-${currentTime}`,
            display_name: `alternate-local-test-${network}`,
            fork_config: {
              network_id: config.chainId,
              block_number: config.forkBlock
            },
            virtual_network_config: {
              chain_config: {
                chain_id: config.chainId
              }
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create ${network} VNet: ${response.status}\n${error}`);
      }

      const data = await response.json();
      const rpc = data.rpcs.find(r => r.name === 'Admin RPC');

      vnetData.push({
        NETWORK: network,
        TENDERLY_TESTNET_ID: data.id,
        TENDERLY_RPC_URL: rpc.url
      });
      console.log(`✅ ${network}: ${data.id}`);
    }

    await writeFile('./tenderlyTestnetData-alternate.json', JSON.stringify(vnetData, null, 2));

    console.log('');
    console.log('✅ All Alternate VNets created successfully!');
    console.log('   Saved to: tenderlyTestnetData-alternate.json');
    console.log('');
    console.log('💰 Now fund the VNets and create snapshots:');
    console.log('   pnpm vnet:alternate:fund');
    console.log('');
    console.log('🧪 Then run the alternate tests:');
    console.log('   pnpm e2e:parallel:alternate');
    console.log('');
    console.log('🧹 When done, cleanup with:');
    console.log('   pnpm vnet:alternate:delete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAlternateVNet();
