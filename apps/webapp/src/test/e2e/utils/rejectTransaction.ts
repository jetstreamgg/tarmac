import { Page } from '@playwright/test';

const URL = 'https://virtual.**.rpc.tenderly.co/**';

export const interceptAndRejectTransactions = async (
  page: Page,
  delayMs: number = 0,
  shouldAllowReadCalls: boolean = false
) => {
  await page.route(URL, async (route, request) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    const isReadCall = request.postData()?.includes('eth_call');
    if (shouldAllowReadCalls && isReadCall) {
      route.continue();
    } else {
      route.abort();
    }
  });
};

/**
 * Intercepts RPC calls and rejects only the second eth_sendTransaction.
 * Allows the first sendTransaction (approve) and all eth_call reads to go through.
 * Use this for testing sequential flows where approve succeeds but the action tx should fail.
 */
export const interceptAndRejectSecondTransaction = async (page: Page, delayMs: number = 0) => {
  let sendTransactionCount = 0;

  await page.route(URL, async (route, request) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const postData = request.postData();
    const isReadCall = postData?.includes('eth_call');
    const isSendTransaction = postData?.includes('eth_sendTransaction');

    if (isReadCall) {
      // Always allow read calls
      route.continue();
    } else if (isSendTransaction) {
      sendTransactionCount++;
      if (sendTransactionCount === 1) {
        // Allow the first eth_sendTransaction (approve)
        route.continue();
      } else {
        // Reject the second eth_sendTransaction (supply/action)
        route.abort();
      }
    } else {
      // Allow other methods (eth_getTransactionReceipt, etc.)
      route.continue();
    }
  });
};

export const interceptAndAllowTransactions = async (page: Page, delayMs: number = 0) => {
  await page.route(URL, async route => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    route.continue();
  });
};
