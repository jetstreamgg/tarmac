// G1 COORDINATION (APP-303 D3): exercises the retired legacy L2SavingsWidget UI/testids (via l2-savings.ts); the savings
// detail page now drives the inline panel (useSavingsLaunch). Left intact for G1 E2E-migration closeout — do not delete/disable here.
import { test } from '../fixtures-parallel';
import { NetworkName } from '../utils/constants.ts';
import { runL2SavingsTests } from './l2-savings.ts';

test.describe('Base savings tests', async () => {
  await runL2SavingsTests({ networkName: NetworkName.base });
});
