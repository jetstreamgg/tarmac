import { test } from '../fixtures-parallel';
import { NetworkName } from '../utils/constants.ts';
import { runL2TradeTests } from './l2-trade.ts';

test.describe('Base trade tests', async () => {
  await runL2TradeTests({ networkName: NetworkName.base });
});
