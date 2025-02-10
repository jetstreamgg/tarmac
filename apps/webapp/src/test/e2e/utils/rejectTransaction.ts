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
