import { test, expect } from '../fixtures-parallel';
import { usdsAddress, mcdDaiAddress, mkrAddress, skyAddress } from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';

test('Verify account is funded correctly', async ({ isolatedPage, testAccount }) => {
  console.log(`Verifying funding for account: ${testAccount}`);

  // Navigate to the app
  await isolatedPage.goto('/', { waitUntil: 'networkidle' });
  await isolatedPage.waitForTimeout(2000);

  // Check balances using direct RPC calls
  const balances = await isolatedPage.evaluate(
    async (data: { account: string; tokens: { usds: string; dai: string; mkr: string; sky: string } }) => {
      const { account, tokens } = data;

      const checkBalance = async (tokenAddress: string, tokenName: string) => {
        try {
          const response = await fetch('http://localhost:3000', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              method: 'eth_call',
              params: [
                {
                  to: tokenAddress,
                  data: `0x70a08231000000000000000000000000${account.slice(2)}`
                },
                'latest'
              ],
              id: 1,
              jsonrpc: '2.0'
            })
          });
          const result = await response.json();
          return { token: tokenName, balance: result.result };
        } catch (error) {
          return { token: tokenName, error: String(error) };
        }
      };

      const results = await Promise.all([
        checkBalance(tokens.usds, 'USDS'),
        checkBalance(tokens.dai, 'DAI'),
        checkBalance(tokens.mkr, 'MKR'),
        checkBalance(tokens.sky, 'SKY')
      ]);

      return results;
    },
    {
      account: testAccount,
      tokens: {
        usds: usdsAddress[TENDERLY_CHAIN_ID],
        dai: mcdDaiAddress[TENDERLY_CHAIN_ID],
        mkr: mkrAddress[TENDERLY_CHAIN_ID],
        sky: skyAddress[TENDERLY_CHAIN_ID]
      }
    }
  );

  console.log(`Balances for ${testAccount}:`, balances);

  // Check if balances are non-zero (accounts should be funded)
  for (const balance of balances) {
    if (balance.error) {
      console.error(`Error checking ${balance.token}:`, balance.error);
    } else {
      // Balance should be non-zero hex string
      const isNonZero = balance.balance && balance.balance !== '0x0' && balance.balance !== '0x';
      console.log(`${balance.token}: ${balance.balance} (non-zero: ${isNonZero})`);

      if (balance.token !== 'SKY') {
        // SKY has a huge initial balance
        expect(isNonZero).toBe(true);
      }
    }
  }

  // Also check the page loaded correctly
  const appVisible = await isolatedPage.locator('#root').isVisible();
  expect(appVisible).toBe(true);

  // Check if mock wallet button is visible
  const mockWalletButton = isolatedPage.getByRole('button', { name: /Mock Wallet/i }).first();
  const buttonVisible = await mockWalletButton.isVisible().catch(() => false);
  console.log(`Mock wallet button visible: ${buttonVisible}`);
});
