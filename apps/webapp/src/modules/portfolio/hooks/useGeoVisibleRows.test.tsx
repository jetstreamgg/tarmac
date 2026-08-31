import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Intent } from '@/lib/enums';
import type { EarnProductRow } from '@/hooks';
import { useGeoVisibleRows } from './useGeoVisibleRows';

const h = vi.hoisted(() => ({
  isLoading: false,
  // Geo modules disabled for the region; empty = unrestricted.
  disabledModules: new Set<string>()
}));

vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({
    isLoading: h.isLoading,
    isModuleEnabled: (moduleId: string) => !h.disabledModules.has(moduleId)
  })
}));

const row = (id: string, intent: Intent) => ({ id, intent }) as EarnProductRow;

const ROWS = [
  row('savings', Intent.SAVINGS_INTENT),
  row('rewards-spk', Intent.REWARDS_INTENT),
  row('vault-usdc', Intent.VAULTS_INTENT)
];

describe('useGeoVisibleRows', () => {
  beforeEach(() => {
    h.isLoading = false;
    h.disabledModules.clear();
  });

  it('passes every row through for an unrestricted region', () => {
    const { result } = renderHook(() => useGeoVisibleRows(ROWS));
    expect(result.current).toEqual(ROWS);
  });

  it('drops rows whose geo module is restricted, preserving order', () => {
    h.disabledModules.add('savings').add('rewards');
    const { result } = renderHook(() => useGeoVisibleRows(ROWS));
    expect(result.current.map(r => r.id)).toEqual(['vault-usdc']);
  });

  it('passes every row through while the geo config loads (restrictive default would blank all gated products)', () => {
    h.isLoading = true;
    h.disabledModules.add('savings');
    const { result } = renderHook(() => useGeoVisibleRows(ROWS));
    expect(result.current).toEqual(ROWS);
  });
});
