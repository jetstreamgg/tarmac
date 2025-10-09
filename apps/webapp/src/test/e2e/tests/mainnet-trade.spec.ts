import { test } from '../fixtures.ts';
import { NetworkName } from '../utils/constants.ts';
import { runCowTradeTests } from './cowswap-trade.ts';

test.describe('Mainnet trade tests', async () => {
  await runCowTradeTests({ networkName: NetworkName.mainnet });
});
