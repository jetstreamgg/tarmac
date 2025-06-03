require('dotenv').config();

const { writeFile } = require('fs/promises');

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

const forkVnets = async () => {
  const currentTime = Date.now();

  const responses = await Promise.all([
    ...[MAINNET_FORK_CONTAINER_ID, BASE_FORK_CONTAINER_ID, ARBITRUM_FORK_CONTAINER_ID].map(containerId =>
      fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/fork', {
        headers: [
          ['accept', 'application/json, text/plain, */*'],
          ['content-type', 'application/json'],
          ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
        ],
        method: 'POST',
        body: JSON.stringify({
          vnet_id: containerId,
          display_name: 'ci-tests-testnet'
        })
      })
    ),
    ...[OPTIMISM_CONFIG, UNICHAIN_CONFIG].map(({ chainId, forkBlock }) =>
      fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets', {
        headers: [
          ['accept', 'application/json, text/plain, */*'],
          ['content-type', 'application/json'],
          ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
        ],
        method: 'POST',
        body: JSON.stringify({
          slug: `ci-tests-testnet-${chainId}-${currentTime}`,
          display_name: 'ci-tests-testnet',
          fork_config: {
            network_id: chainId,
            block_number: forkBlock
          },
          virtual_network_config: {
            chain_config: {
              chain_id: chainId
            }
          }
        })
      })
    )
  ]);

  const testnetsData = await Promise.all(responses.map(response => response.json()));

  for (const res of responses) {
    if (res.status !== 200) {
      console.error('There was an error while forking the virtual testnet:', res.statusText);
      process.exit(1);
    }
  }

  const testnetDataToWrite = testnetsData.map(testnetData => {
    const adminEndpoint = testnetData.rpcs.find(
      //@ts-expect-error TypeScript syntax is not supported when running this script
      x => x.name === 'Admin RPC'
    );

    return {
      TENDERLY_TESTNET_ID: testnetData.id,
      TENDERLY_RPC_URL: adminEndpoint.url
    };
  });

  await writeFile('./tenderlyTestnetData.json', JSON.stringify(testnetDataToWrite));
};

forkVnets();
