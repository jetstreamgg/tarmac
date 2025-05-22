import { readFile } from 'fs/promises';
import { backOffRetry } from './setBalance';
import path from 'path';

const waitForVnetsReadyRequest = async () => {
  try {
    const filePath = path.resolve('../../tenderlyTestnetData.json');
    console.log('Attempting to read testnet data from:', filePath);

    const file = await readFile(filePath, 'utf-8');
    const testnetsData = JSON.parse(file);

    console.log(`Found ${testnetsData.length} virtual networks to check`);

    // We send an `eth_blockNumber` request to the RPC endpoints to "ping" them
    const responses = await Promise.all(
      testnetsData.map(async ({ TENDERLY_RPC_URL }: { TENDERLY_RPC_URL: string }, index: number) => {
        console.log(`Checking network ${index + 1}/${testnetsData.length}: ${TENDERLY_RPC_URL}`);
        try {
          const response = await fetch(TENDERLY_RPC_URL, {
            method: 'POST',
            headers: {
              accept: '*/*',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              method: 'eth_blockNumber',
              params: [],
              id: 42,
              jsonrpc: '2.0'
            })
          });

          const responseBody = await response.text();
          console.log(`Network ${index + 1} response:`, {
            status: response.status,
            statusText: response.statusText,
            body: responseBody
          });

          return response;
        } catch (error) {
          console.error(`Failed to check network ${index + 1}:`, error);
          throw error;
        }
      })
    );

    // If all of the RPC endpoints respond with status 200, it means they are ready
    const allReady = responses.every(({ status }: { status: number }) => status === 200);
    if (!allReady) {
      const failedNetworks = responses
        .map((response, index) => ({ index: index + 1, status: response.status }))
        .filter(({ status }) => status !== 200);

      throw new Error(`Virtual testnets are not ready. Failed networks: ${JSON.stringify(failedNetworks)}`);
    }

    console.log('All virtual networks are ready!');
  } catch (error) {
    console.error('Error in waitForVnetsReadyRequest:', error);
    throw error;
  }
};

export const waitForVnetsReady = async () => {
  console.log('Starting virtual network readiness check...');
  await backOffRetry(() => waitForVnetsReadyRequest(), 6, 1);
  console.log('Virtual network readiness check completed successfully');
};
