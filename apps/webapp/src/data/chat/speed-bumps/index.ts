import { SpeedBumpContent } from './types';
import { skyTokenRewardsSpeedBump } from './sky-token-rewards';
import { skySavingsRateSpeedBump } from './sky-savings-rate';
import { upgradeSpeedBump } from './upgrade';
import { tradeSpeedBump } from './trade';
import { expertModulesSpeedBump } from './expert-modules';
import { stakingEngineSpeedBump } from './staking-engine';

export { skyTokenRewardsSpeedBump } from './sky-token-rewards';
export { skySavingsRateSpeedBump } from './sky-savings-rate';
export { upgradeSpeedBump } from './upgrade';
export { tradeSpeedBump } from './trade';
export { expertModulesSpeedBump } from './expert-modules';
export { stakingEngineSpeedBump } from './staking-engine';

export const speedBumps: SpeedBumpContent[] = [
  skyTokenRewardsSpeedBump,
  skySavingsRateSpeedBump,
  upgradeSpeedBump,
  tradeSpeedBump,
  expertModulesSpeedBump,
  stakingEngineSpeedBump
];
