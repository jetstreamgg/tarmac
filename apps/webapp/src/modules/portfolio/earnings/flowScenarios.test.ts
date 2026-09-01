import { describe, expect, it } from 'vitest';
import { FLOW_SCENARIOS } from './flowScenarios.fixtures';

/**
 * Guards the scenario literals themselves: every expectedEarned must match the
 * dossier's flows formula recomputed from the raw timeline, and every flow
 * must sit inside its window. A typo here would otherwise surface as a
 * mysterious computeMorphoEarnings failure in a later session.
 */
describe('FLOW_SCENARIOS consistency', () => {
  it.each(FLOW_SCENARIOS.map(s => [s.name, s] as const))('%s', (_name, scenario) => {
    const depositSum = scenario.deposits.reduce((acc, [, assets]) => acc + assets, 0);
    const withdrawalSum = scenario.withdrawals.reduce((acc, [, assets]) => acc + assets, 0);
    const earned = scenario.endAssets - scenario.startAssets - depositSum + withdrawalSum;
    expect(earned).toBeCloseTo(scenario.expectedEarned, 10);

    for (const [t] of [...scenario.deposits, ...scenario.withdrawals]) {
      expect(t).toBeGreaterThanOrEqual(scenario.window.startSec);
      expect(t).toBeLessThanOrEqual(scenario.window.endSec);
    }
  });

  it('includes the zero-yield scenario asserting exact zero', () => {
    const zero = FLOW_SCENARIOS.find(s => s.name === 'zero yield is exactly zero');
    expect(zero?.expectedEarned).toBe(0);
  });
});
