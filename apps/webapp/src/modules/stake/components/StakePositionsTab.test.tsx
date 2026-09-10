import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';

i18n.load('en', {});
i18n.activate('en');

let mockPositions: {
  data?: StakeUserPosition[];
  isLoading: boolean;
  error: Error | null;
} = { data: [], isLoading: false, error: null };

vi.mock('../hooks/useStakeUserPositions', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeUserPositions')>();
  return {
    ...actual,
    useStakeUserPositions: () => ({ ...mockPositions, mutate: vi.fn() })
  };
});

const h = vi.hoisted(() => ({ tableProps: undefined as Record<string, unknown> | undefined }));

vi.mock('./StakePositionsTable', () => ({
  StakePositionsTable: (props: Record<string, unknown>) => {
    h.tableProps = props;
    return <div data-testid="stake-positions-table-stub" />;
  }
}));
vi.mock('./StakeActivityTable', () => ({
  StakeActivityTable: () => <div data-testid="stake-activity-table-stub" />
}));
// The rail's three states are pinned in StakeRailCard.test.tsx; here the stub
// only proves the tab mounts the shared rail card in its rail cell.
vi.mock('./StakeRailCard', () => ({
  StakeRailCard: () => <div data-testid="stake-rail-card-stub" />
}));

import { StakePositionsTab } from './StakePositionsTab';

const renderTab = (onRemediate = vi.fn()) =>
  render(
    <I18nProvider i18n={i18n}>
      <StakePositionsTab onRemediate={onRemediate} />
    </I18nProvider>
  );

describe('StakePositionsTab', () => {
  afterEach(cleanup);

  it('passes onRemediate straight through to the positions table', () => {
    const onRemediate = vi.fn();
    mockPositions = { data: [], isLoading: false, error: null };
    renderTab(onRemediate);

    expect(h.tableProps?.onRemediate).toBe(onRemediate);
  });

  it('mounts the tables and the shared rail card', () => {
    mockPositions = { data: [], isLoading: false, error: null };
    renderTab();

    expect(screen.getByTestId('stake-positions-tab')).toBeTruthy();
    expect(screen.getByTestId('stake-positions-table-stub')).toBeTruthy();
    expect(screen.getByTestId('stake-activity-table-stub')).toBeTruthy();
    expect(screen.getByTestId('stake-rail-card-stub')).toBeTruthy();
  });
});
