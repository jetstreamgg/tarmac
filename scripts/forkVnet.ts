require('dotenv').config();
//@ts-expect-error readFile is already declared
const { writeFile, readFile } = require('fs/promises');

const MAINNET_FORK_CONTAINER_ID = process.env.MAINNET_FORK_CONTAINER_ID;
if (!MAINNET_FORK_CONTAINER_ID) {
  console.error(
    'MAINNET_FORK_CONTAINER_ID is required. Copy .env.example to .env or set the variable in CI.'
  );
  process.exit(1);
}

// Allow override via environment variable for custom vnet naming
// Usage: VNET_PREFIX=my-prefix pnpm vnet:fork
// Default: ci-tests-testnet
const VNET_PREFIX = process.env.VNET_PREFIX || 'ci-tests-testnet';

const ARBITRUM_CONFIG = {
  chainId: 42161,
  // Fixed block from after the Arbitrum PSM was funded
  forkBlock: '343221023'
};
const BASE_CONFIG = {
  chainId: 8453,
  // Fixed block from after the Base PSM was funded
  forkBlock: '31758878'
};
const OPTIMISM_CONFIG = {
  chainId: 10,
  // Fixed block from after the Optimism PSM was funded
  forkBlock: '136644925'
};
const UNICHAIN_CONFIG = {
  chainId: 130,
  // Fixed block from after the Unichain PSM was funded
  forkBlock: '18140271'
};

const forkVnets = async chainType => {
  const currentTime = Date.now();

  const chainsToFork = chainType ?? ['mainnet', 'base', 'arbitrum', 'optimism', 'unichain']; // Re-enable when we add tests for these chains

  // allSettled + async callback: a failed fork (rejected fetch, unsupported chain)
  // must not hide the ones that did get created, so they can be cleaned up below.
  const results = await Promise.allSettled(
    chainsToFork.map(async chain => {
      switch (chain) {
        case 'mainnet':
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/fork', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              vnet_id: MAINNET_FORK_CONTAINER_ID,
              display_name: VNET_PREFIX
            })
          });
        case 'base':
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              slug: `${VNET_PREFIX}-${BASE_CONFIG.chainId}-${currentTime}`,
              display_name: VNET_PREFIX,
              fork_config: {
                network_id: BASE_CONFIG.chainId,
                block_number: BASE_CONFIG.forkBlock
              },
              virtual_network_config: {
                chain_config: {
                  chain_id: BASE_CONFIG.chainId
                }
              }
            })
          });
        case 'arbitrum':
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              slug: `${VNET_PREFIX}-${ARBITRUM_CONFIG.chainId}-${currentTime}`,
              display_name: VNET_PREFIX,
              fork_config: {
                network_id: ARBITRUM_CONFIG.chainId,
                block_number: ARBITRUM_CONFIG.forkBlock
              },
              virtual_network_config: {
                chain_config: {
                  chain_id: ARBITRUM_CONFIG.chainId
                }
              }
            })
          });
        case 'optimism':
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              slug: `${VNET_PREFIX}-${OPTIMISM_CONFIG.chainId}-${currentTime}`,
              display_name: VNET_PREFIX,
              fork_config: {
                network_id: OPTIMISM_CONFIG.chainId,
                block_number: OPTIMISM_CONFIG.forkBlock
              },
              virtual_network_config: {
                chain_config: {
                  chain_id: OPTIMISM_CONFIG.chainId
                }
              }
            })
          });
        case 'unichain':
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              slug: `${VNET_PREFIX}-${UNICHAIN_CONFIG.chainId}-${currentTime}`,
              display_name: VNET_PREFIX,
              fork_config: {
                network_id: UNICHAIN_CONFIG.chainId,
                block_number: UNICHAIN_CONFIG.forkBlock
              },
              virtual_network_config: {
                chain_config: {
                  chain_id: UNICHAIN_CONFIG.chainId
                }
              }
            })
          });
        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }
    })
  );

  const testnetsData = await Promise.all(
    results.map(async (result, index) => {
      const chain = chainsToFork[index];
      if (result.status === 'rejected') {
        console.error(`Forking ${chain} failed:`, result.reason);
        return null;
      }
      const res = result.value;
      console.log('Response:', res);
      const data = await res.json().catch(() => null);
      if (res.status !== 200 || !data?.id) {
        console.error(`There was an error while forking the ${chain} virtual testnet:`, res.statusText, data);
        return null;
      }
      return data;
    })
  );

  if (testnetsData.some(data => data === null)) {
    // Don't leave the forks that did succeed running until the next delete:all sweep
    const created = testnetsData.filter(Boolean);
    const deleted = await Promise.all(
      created.map(async ({ id }) => {
        const res = await fetch(
          `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/testnet/container/${id}`,
          {
            headers: [['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]],
            method: 'DELETE'
          }
        ).catch(error => error);
        if (res.status !== 204) {
          console.error(`Failed to delete orphaned virtual testnet ${id}:`, res.statusText ?? res);
          return false;
        }
        return true;
      })
    );
    console.error(
      `Deleted ${deleted.filter(Boolean).length}/${created.length} virtual testnet(s) created before the failure.`
    );
    process.exit(1);
  }

  // Log the current state of vnets after creation
  console.log('Fetching current vnets state...');
  try {
    const vnetsResponse = await fetch(
      'https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets',
      {
        headers: [
          ['accept', 'application/json, text/plain, */*'],
          ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
        ],
        method: 'GET'
      }
    );

    if (vnetsResponse.ok) {
      const vnetsData = await vnetsResponse.json();
      console.log('Current vnets state:', JSON.stringify(vnetsData, null, 2));
    } else {
      console.error('Failed to fetch vnets state:', vnetsResponse.status, vnetsResponse.statusText);
    }
  } catch (error) {
    console.error('Error fetching vnets state:', error);
  }

  // Read existing data if file exists
  let existingData;
  try {
    const existingFile = await readFile('./tenderlyTestnetData.json', 'utf-8');
    existingData = JSON.parse(existingFile);
  } catch (error) {
    console.warn('There was an error reading the tenderlyTestnetData.json file', error);
    // File doesn't exist or is invalid JSON, start with empty array
    existingData = [];
  }

  // Update or add new chain data
  const updatedData = existingData.filter(item => !chainsToFork.includes(item.NETWORK));

  // Add the newly forked chains
  chainsToFork.forEach((chain, index) => {
    const testnetData = testnetsData[index];
    const adminEndpoint = testnetData.rpcs.find(x => x.name === 'Admin RPC');

    updatedData.push({
      NETWORK: chain,
      TENDERLY_TESTNET_ID: testnetData.id,
      TENDERLY_RPC_URL: adminEndpoint.url
    });
  });

  await writeFile('./tenderlyTestnetData.json', JSON.stringify(updatedData));
};

// Get chain type from command line argument
const chainType = process.argv[2];
const chainsToFork = chainType
  ? chainType.split(',').map(chain => chain.trim())
  : ['mainnet', 'base', 'arbitrum', 'optimism', 'unichain'];
forkVnets(chainsToFork);
