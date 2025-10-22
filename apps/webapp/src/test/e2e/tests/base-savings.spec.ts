import { test } from '../fixtures-parallel';
import { NetworkName } from '../utils/constants.ts';
import { runL2SavingsTests } from './l2-savings.ts';

test.describe('Base savings tests', async () => {
  await runL2SavingsTests({ networkName: NetworkName.base });
});
