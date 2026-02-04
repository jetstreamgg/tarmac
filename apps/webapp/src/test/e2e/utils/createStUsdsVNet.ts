/**
 * Creates a dedicated Tenderly VNet for stUSDS provider switching tests.
 * Uses the NEW fork (cec455a4...) which has the Curve pool properly configured.
 */

const NEW_MAINNET_FORK_CONTAINER_ID = 'cec455a4-3a8a-4a93-ac66-fc98fa1a8103';

export interface StUsdsVNet {
  id: string;
  rpcUrl: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a dedicated VNet for stUSDS tests by forking the new mainnet container
 */
export async function createStUsdsVNet(): Promise<StUsdsVNet> {
  const tenderlyApiKey = process.env.TENDERLY_API_KEY;
  if (!tenderlyApiKey) {
    throw new Error('TENDERLY_API_KEY environment variable is required');
  }

  console.log('Creating dedicated VNet for stUSDS provider test...');

  // Fork the new mainnet container (has Curve pool)
  const response = await fetch(
    'https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/fork',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': tenderlyApiKey
      },
      body: JSON.stringify({
        vnet_id: NEW_MAINNET_FORK_CONTAINER_ID,
        display_name: 'stusds-provider-test'
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create VNet: ${response.statusText}`);
  }

  const vnetData = await response.json();
  const adminRpc = vnetData.rpcs.find((r: any) => r.name === 'Admin RPC');

  if (!adminRpc) {
    throw new Error('Admin RPC not found in VNet response');
  }

  console.log(`✅ Created dedicated VNet: ${vnetData.id}`);

  return {
    id: vnetData.id,
    rpcUrl: adminRpc.url,
    cleanup: async () => {
      console.log(`Cleaning up dedicated VNet: ${vnetData.id}`);
      try {
        await fetch(
          `https://api.tenderly.co/api/v1/account/jetstreamgg/project/jetstream/vnets/${vnetData.id}`,
          {
            method: 'DELETE',
            headers: {
              'X-Access-Key': tenderlyApiKey
            }
          }
        );
        console.log('✅ VNet cleanup complete');
      } catch (error) {
        console.warn('⚠️  Failed to cleanup VNet:', error);
      }
    }
  };
}

/**
 * Waits for the VNet to be ready by pinging the RPC endpoint
 */
export async function waitForStUsdsVNetReady(rpcUrl: string, maxRetries = 30): Promise<void> {
  console.log('Waiting for VNet to be ready...');

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      });

      if (response.ok) {
        console.log('✅ VNet is ready');
        return;
      }
    } catch {
      // Network error, keep retrying
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    process.stdout.write('.');
  }

  throw new Error('VNet did not become ready in time');
}
