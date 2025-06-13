require('dotenv').config();
//@ts-expect-error readFile is already declared
const { writeFile, readFile } = require('fs/promises');

// corresponds to https://dashboard.tenderly.co/jetstreamgg/jetstream/testnet/67d03866-3483-455a-a001-7f9f69b1c5d4
const MAINNET_FORK_CONTAINER_ID = '67d03866-3483-455a-a001-7f9f69b1c5d4';
// corresponds to https://dashboard.tenderly.co/jetstreamgg/jetstream/testnet/d382d976-02a4-4fc2-a9ba-db43a1602719
const BASE_FORK_CONTAINER_ID = 'd382d976-02a4-4fc2-a9ba-db43a1602719';
// corresponds to https://dashboard.tenderly.co/jetstreamgg/jetstream/testnet/d720e619-0124-4c51-aae9-f32dcba6de2a
const ARBITRUM_FORK_CONTAINER_ID = 'd720e619-0124-4c51-aae9-f32dcba6de2a';

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

  const chainsToFork = chainType ?? ['mainnet', 'base', 'arbitrum' /*'optimism', 'unichain'*/]; // Re-enable when we add tests for these chains

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
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/fork', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              vnet_id: BASE_FORK_CONTAINER_ID,
              display_name: 'ci-tests-testnet'
            })
          });
        case 'arbitrum':
          return fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/fork', {
            headers: [
              ['accept', 'application/json, text/plain, */*'],
              ['content-type', 'application/json'],
              ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
            ],
            method: 'POST',
            body: JSON.stringify({
              vnet_id: ARBITRUM_FORK_CONTAINER_ID,
              display_name: 'ci-tests-testnet'
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
    if (res.status !== 200) {
      console.error('There was an error while forking the virtual testnet:', res.statusText);
      process.exit(1);
    }
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
