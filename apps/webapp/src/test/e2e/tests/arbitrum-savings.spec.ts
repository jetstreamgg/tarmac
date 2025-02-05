import { test } from '../fixtures.ts';
import { NetworkName } from '../utils/constants.ts';
import { runL2SavingsTests } from './l2-savings.ts';

test.describe('Arbitrum savings tests', async () => {
  await runL2SavingsTests({ networkName: NetworkName.arbitrum });
});
