import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { NetworkName } from './constants';

/**
 * Initialize a test account by performing a small self-transfer.
 * This establishes the account on-chain and can help with balance update issues.
 */
export async function initializeTestAccount(address: `0x${string}`): Promise<boolean> {
  console.log(`🔄 Initializing test account ${address}...`);

  try {
    const rpcUrl = await getRpcUrlFromFile(NetworkName.mainnet);
    if (!rpcUrl) {
      console.warn('⚠️ No RPC URL available, skipping initialization');
      return false;
    }

    // Send a tiny self-transfer to initialize the account
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: address,
            value: '0x1', // 1 wei
            gas: '0x5208' // 21000 gas for simple transfer
          }
        ]
      })
    });

    const result = await response.json();
    if (result.error) {
      console.warn(`⚠️ Failed to initialize account: ${result.error.message}`);
      return false;
    }

    console.log(`✅ Account initialized with tx: ${result.result}`);
    return true;
  } catch (error: any) {
    console.warn('⚠️ Error initializing account:', error.message);
    return false;
  }
}
