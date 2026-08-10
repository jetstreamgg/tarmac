import { describe, expect, it } from 'vitest';
import type { EarnProductRow } from '@/hooks';
import { Intent } from '@/lib/enums';
import type { ModuleId } from '@/modules/geo-config/types';
import { partitionByGeoAvailability } from './geoAvailability';

const row = (id: string, intent: Intent): EarnProductRow =>
  ({
    id,
    kind: 'savings',
    intent,
    name: id,
    tokenSymbol: 'sUSDS',
    supplyTokens: ['USDS'],
    risk: 'moderate',
    riskProfile: 'savings',
    networks: [1],
    detailPath: '/earn/savings',
    rate: { formatted: '—' },
    isLoading: false,
    error: null
  }) as EarnProductRow;

const ROWS: EarnProductRow[] = [
  row('savings', Intent.SAVINGS_INTENT),
  row('vault-flagship', Intent.VAULTS_INTENT),
  row('rewards-spk', Intent.REWARDS_INTENT),
  row('fixed-susds', Intent.FIXED_INTENT),
  row('stusds', Intent.EXPERT_INTENT)
];

/** The FALLBACK_CONFIG shape: savings / rewards / expert off, the rest on. */
const restricted = (moduleId: ModuleId) => !['savings', 'rewards', 'expert'].includes(moduleId);

describe('partitionByGeoAvailability', () => {
  it('moves the restricted modules into the unavailable list, in registry order', () => {
    const { availableRows, unavailableRows } = partitionByGeoAvailability(ROWS, restricted);

    expect(availableRows.map(r => r.id)).toEqual(['vault-flagship', 'fixed-susds']);
    expect(unavailableRows.map(r => r.id)).toEqual(['savings', 'rewards-spk', 'stusds']);
  });

  it('leaves everything available when no module is restricted', () => {
    const { availableRows, unavailableRows } = partitionByGeoAvailability(ROWS, () => true);

    expect(availableRows).toHaveLength(ROWS.length);
    expect(unavailableRows).toHaveLength(0);
  });

  it('never restricts a product whose intent maps to no geo module', () => {
    const rows = [row('convert', Intent.CONVERT_INTENT)];

    expect(partitionByGeoAvailability(rows, () => false).availableRows).toEqual(rows);
  });
});
