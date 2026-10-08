import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StakeOverviewTab } from './StakeOverviewTab';

i18n.load('en', {});
i18n.activate('en');

// Composition test: each child owns its data states and has its own suite —
// this pins that the tab mounts them in their grid slots, plus the Links row.
vi.mock('./StakeRateChart', () => ({
  StakeRateChart: () => <div data-testid="stub-rate-chart" />
}));
vi.mock('./StakeDetailsStrip', () => ({
  StakeDetailsStrip: () => <div data-testid="stub-details-strip" />
}));
vi.mock('./BorrowUtilizationBlock', () => ({
  BorrowUtilizationBlock: () => <div data-testid="stub-borrow-utilization" />
}));
vi.mock('./StakeRailCard', () => ({
  StakeRailCard: () => <div data-testid="stub-rail-card" />
}));

// Pin the chain so the Etherscan href is deterministic (mainnet).
vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

const renderTab = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeOverviewTab rail={{ positions: [], isLoading: false }} />
    </I18nProvider>
  );

describe('StakeOverviewTab', () => {
  it('stacks chart, Details, Borrow Utilization and Links in the left column, with the rail card in its own rail', () => {
    renderTab();

    const chart = screen.getByTestId('stub-rate-chart');
    const strip = screen.getByTestId('stub-details-strip');
    const utilization = screen.getByTestId('stub-borrow-utilization');
    const links = screen.getByTestId('stake-overview-links');
    const railCard = screen.getByTestId('stub-rail-card');

    const leftColumn = chart.parentElement;
    expect(strip.parentElement).toBe(leftColumn);
    expect(utilization.parentElement).toBe(leftColumn);
    expect(links.parentElement).toBe(leftColumn);
    const children = Array.from(leftColumn?.children ?? []);
    expect(children.indexOf(chart)).toBeLessThan(children.indexOf(strip));
    expect(children.indexOf(strip)).toBeLessThan(children.indexOf(utilization));
    expect(children.indexOf(utilization)).toBeLessThan(children.indexOf(links));

    // The rail card sits in its own cell of the same top-level grid, so it
    // never inherits the left column's (much taller) height.
    const railCell = railCard.parentElement;
    expect(railCell).not.toBe(leftColumn);
    const grid = leftColumn?.parentElement;
    expect(grid).toBe(railCell?.parentElement);
    expect(grid?.className).toContain('items-start');

    // Mobile order: rail card first, then the left column.
    expect(railCell?.className).toContain('order-1');
    expect(leftColumn?.className).toContain('order-2');
  });

  it('keeps the stack through the tablet seam and splits only from desktop', () => {
    renderTab();

    const grid = screen.getByTestId('stub-rate-chart').parentElement?.parentElement;
    expect(grid?.className).toContain('desktop:grid-cols-3');
    expect(grid?.className).not.toMatch(/\blg:/);
    expect(grid?.className).toMatch(/(^| )grid-cols-1( |$)/);
  });

  it('renders View contract and Governance links, and no Docs link yet', () => {
    renderTab();

    const anchors = screen.getByTestId('stake-overview-links').querySelectorAll('a');
    expect(anchors.length).toBe(2);
    anchors.forEach(a => {
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
      expect(a.getAttribute('target')).toBe('_blank');
    });
    expect(screen.queryByText('Docs')).toBeNull();
    expect(screen.getByText('Governance').closest('a')?.getAttribute('href')).toBe('https://vote.sky.money/');
    expect(screen.getByText('View contract').closest('a')?.getAttribute('href')).toContain(
      'etherscan.io/address/'
    );
  });
});
