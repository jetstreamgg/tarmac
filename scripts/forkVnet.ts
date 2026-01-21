require('dotenv').config();
//@ts-expect-error readFile is already declared
const { writeFile, readFile } = require('fs/promises');

const MAINNET_FORK_CONTAINER_ID = 'be542d83-b79b-4f0f-8113-63a5157c4275';

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

//@ts-expect-error script doesn't work with TS
const forkVnets = async chainType => {
  const currentTime = Date.now();

  const chainsToFork = chainType ?? ['mainnet', 'base', 'arbitrum', 'optimism', 'unichain']; // Re-enable when we add tests for these chains

  const responses = await Promise.all(
    //@ts-expect-error script doesn't work with TS
    chainsToFork.map(chain => {
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
              display_name: 'ci-tests-testnet'
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
              slug: `ci-tests-testnet-${BASE_CONFIG.chainId}-${currentTime}`,
              display_name: 'ci-tests-testnet',
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
              slug: `ci-tests-testnet-${ARBITRUM_CONFIG.chainId}-${currentTime}`,
              display_name: 'ci-tests-testnet',
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
              slug: `ci-tests-testnet-${OPTIMISM_CONFIG.chainId}-${currentTime}`,
              display_name: 'ci-tests-testnet',
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
              slug: `ci-tests-testnet-${UNICHAIN_CONFIG.chainId}-${currentTime}`,
              display_name: 'ci-tests-testnet',
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
      }
    })
  );

  const testnetsData = await Promise.all(responses.map(response => response.json()));

  for (const res of responses) {
    console.log('Response:', res);
    if (res.status !== 200) {
      console.error('There was an error while forking the virtual testnet:', res.statusText);
      process.exit(1);
    }
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
  let existingData = [];
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
