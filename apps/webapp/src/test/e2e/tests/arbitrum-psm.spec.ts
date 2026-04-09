import { test } from '../fixtures-parallel';
import { NetworkName } from '../utils/constants';
import { runPsmConversionTests } from './psm-conversion';

test.describe('Arbitrum PSM 1:1 Conversion tests', async () => {
  await runPsmConversionTests({ networkName: NetworkName.arbitrum });
});
