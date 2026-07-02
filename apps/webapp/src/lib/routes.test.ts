import { describe, it, expect } from 'vitest';
import { Intent } from './enums';
import { IntentMapping } from './constants';
import { ROUTES, intentToPath, pathToIntent } from './routes';

// TRADE/UPGRADE fold into Convert: intentToPath aliases them, so they sit
// outside the strict inverse and pathToIntent never returns them.
const ALIAS_INTENTS = [Intent.TRADE_INTENT, Intent.UPGRADE_INTENT];
const ROUTED_INTENTS = (Object.keys(IntentMapping) as Intent[]).filter(
  intent => !ALIAS_INTENTS.includes(intent)
);

describe('intentToPath', () => {
  it('maps each routed intent to its target-IA destination', () => {
    expect(intentToPath(Intent.BALANCES_INTENT)).toBe('/portfolio');
    expect(intentToPath(Intent.SAVINGS_INTENT)).toBe('/earn/savings');
    expect(intentToPath(Intent.REWARDS_INTENT)).toBe('/earn/rewards');
    expect(intentToPath(Intent.VAULTS_INTENT)).toBe('/earn/vaults');
    expect(intentToPath(Intent.FIXED_INTENT)).toBe('/earn/fixed');
    expect(intentToPath(Intent.EXPERT_INTENT)).toBe('/earn/stusds');
    expect(intentToPath(Intent.STAKE_INTENT)).toBe('/stake');
    expect(intentToPath(Intent.CONVERT_INTENT)).toBe('/convert');
  });

  it('aliases the folded-into-convert intents to the convert destination', () => {
    expect(intentToPath(Intent.TRADE_INTENT)).toBe('/convert');
    expect(intentToPath(Intent.UPGRADE_INTENT)).toBe('/convert');
  });

  it('appends a product-instance slug as a path segment', () => {
    expect(intentToPath(Intent.FIXED_INTENT, 'spk-usds')).toBe('/earn/fixed/spk-usds');
    expect(intentToPath(Intent.REWARDS_INTENT, 'usds-skyfarm')).toBe('/earn/rewards/usds-skyfarm');
  });

  it('ignores an empty slug', () => {
    expect(intentToPath(Intent.FIXED_INTENT, '')).toBe('/earn/fixed');
  });
});

describe('pathToIntent', () => {
  it('classifies instance paths by their product base', () => {
    expect(pathToIntent('/earn/fixed/spk-usds')).toBe(Intent.FIXED_INTENT);
    expect(pathToIntent('/earn/rewards/usds-skyfarm')).toBe(Intent.REWARDS_INTENT);
  });

  it('tolerates trailing slashes', () => {
    expect(pathToIntent('/portfolio/')).toBe(Intent.BALANCES_INTENT);
    expect(pathToIntent('/earn/savings/')).toBe(Intent.SAVINGS_INTENT);
  });

  it('returns null for the earn marketplace (net-new IA, no legacy intent)', () => {
    expect(pathToIntent('/earn')).toBeNull();
  });

  it('returns null for non-product and unknown paths', () => {
    expect(pathToIntent('/')).toBeNull();
    expect(pathToIntent('/dev')).toBeNull();
    expect(pathToIntent('/seal-engine')).toBeNull();
    expect(pathToIntent('/batch-transactions-legal-notice')).toBeNull();
    expect(pathToIntent('/bogus')).toBeNull();
  });
});

describe('intentToPath ⇄ pathToIntent inverse (exhaustive over IntentMapping)', () => {
  it('pathToIntent(intentToPath(intent)) === intent for every routed intent', () => {
    for (const intent of ROUTED_INTENTS) {
      expect(pathToIntent(intentToPath(intent))).toBe(intent);
    }
  });

  it('holds with a product-instance slug', () => {
    for (const intent of ROUTED_INTENTS) {
      expect(pathToIntent(intentToPath(intent, 'some-slug'))).toBe(intent);
    }
  });

  it('alias intents resolve to CONVERT through the round trip', () => {
    for (const intent of ALIAS_INTENTS) {
      expect(pathToIntent(intentToPath(intent))).toBe(Intent.CONVERT_INTENT);
    }
  });

  it('intentToPath(pathToIntent(path)) === path for every intent-bearing route', () => {
    const intentBearing = ROUTED_INTENTS.map(intent => intentToPath(intent));
    for (const path of intentBearing) {
      const intent = pathToIntent(path);
      expect(intent).not.toBeNull();
      expect(intentToPath(intent as Intent)).toBe(path);
    }
  });

  it('every IntentMapping entry is covered: routed or a documented alias', () => {
    for (const intent of Object.keys(IntentMapping) as Intent[]) {
      expect(Object.values(ROUTES)).toContain(intentToPath(intent));
    }
  });
});
