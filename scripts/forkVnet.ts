require('dotenv').config();

const { writeFile } = require('fs/promises');

// corresponds to https://dashboard.tenderly.co/jetstreamgg/jetstream/testnet/0f6b2f0e-98ca-4a7e-abaf-f2405dadf063
const MAINNET_FORK_CONTAINER_ID = '0f6b2f0e-98ca-4a7e-abaf-f2405dadf063';
// corresponds to https://dashboard.tenderly.co/jetstreamgg/jetstream/testnet/d382d976-02a4-4fc2-a9ba-db43a1602719
const BASE_FORK_CONTAINER_ID = 'd382d976-02a4-4fc2-a9ba-db43a1602719';
// corresponds to https://dashboard.tenderly.co/jetstreamgg/jetstream/testnet/d720e619-0124-4c51-aae9-f32dcba6de2a
const ARBITRUM_FORK_CONTAINER_ID = 'd720e619-0124-4c51-aae9-f32dcba6de2a';

console.log('process.env', process.env);
console.log('process.env.TENDERLY_API_KEY', process.env.TENDERLY_API_KEY);

const forkVnets = async () => {
  const responses = await Promise.all(
    [MAINNET_FORK_CONTAINER_ID, BASE_FORK_CONTAINER_ID, ARBITRUM_FORK_CONTAINER_ID].map(containerId =>
      fetch('https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/testnet/clone', {
        headers: [
          ['accept', 'application/json, text/plain, */*'],
          ['content-type', 'application/json'],
          ['X-Access-Key', `${process.env.TENDERLY_API_KEY}`]
        ],
        method: 'POST',
        body: JSON.stringify({
          srcContainerId: containerId,
          dstContainerDisplayName: 'ci-tests-testnet'
        })
      })
    )
  );

  const testnetsData = await Promise.all(responses.map(response => response.json()));

  for (const res of responses) {
    if (res.status !== 200) {
      console.error('There was an error while forking the virtual testnet:', res.statusText);
      process.exit(1);
    }
  }

  const testnetDataToWrite = testnetsData.map(testnetData => {
    const adminEndpoint = testnetData.connectivityConfig.endpoints.find(
      //@ts-ignore
      x => x.description === 'admin endpoint'
    );

    return {
      TENDERLY_TESTNET_ID: testnetData.id,
      TENDERLY_RPC_URL: adminEndpoint.uri
    };
  });

  await writeFile('./tenderlyTestnetData.json', JSON.stringify(testnetDataToWrite));
};

forkVnets();
