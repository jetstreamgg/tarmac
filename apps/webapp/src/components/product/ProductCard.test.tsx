import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NO_VALUE, ProductFigure, ProductPercent, ProductStat, ProductStatPair } from './ProductCard';

afterEach(cleanup);

describe('ProductPercent', () => {
  it('splits the trailing % onto the success gradient', () => {
    const { container } = render(<ProductPercent value="3.75%" />);

    // The figure and the unit are separate nodes so only the unit is tinted.
    expect(container.textContent).toBe('3.75%');
    const unit = screen.getByText('%');
    expect(unit.className).toContain('from-success-gradient-start');
    expect(unit.className).toContain('bg-clip-text');
    expect(screen.getByText('3.75')).toBeTruthy();
  });

  it('renders a dash placeholder on fg-secondary rather than the value colour', () => {
    render(<ProductPercent value={NO_VALUE} />);

    const dash = screen.getByText(NO_VALUE);
    expect(dash.className).toContain('text-fgSecondary');
    // The gradient belongs to a real unit only.
    expect(dash.className).not.toContain('from-success-gradient-start');
  });
});

describe('ProductFigure', () => {
  it('renders the figure and its marks when the value is real', () => {
    render(
      <ProductFigure value="9,999.90">
        9,999.90
        <span data-testid="mark" />
      </ProductFigure>
    );

    expect(screen.getByText('9,999.90')).toBeTruthy();
    expect(screen.getByTestId('mark')).toBeTruthy();
  });

  it('drops the marks for a dash, so a missing value never reads as "0 of this token"', () => {
    render(
      <ProductFigure value={NO_VALUE}>
        {NO_VALUE}
        <span data-testid="mark" />
      </ProductFigure>
    );

    expect(screen.getByText(NO_VALUE).className).toContain('text-fgSecondary');
    expect(screen.queryByTestId('mark')).toBeNull();
  });
});

describe('ProductStatPair', () => {
  const stat = (label: string) => <ProductStat label={label}>{label} value</ProductStat>;

  it('interleaves one hairline between the stats, never around them', () => {
    render(
      <ProductStatPair>
        {stat('Current Rate')}
        {stat('Idle balance')}
      </ProductStatPair>
    );

    const dividers = screen.getAllByTestId('product-stat-divider');
    expect(dividers).toHaveLength(1);
    // Between, not leading or trailing.
    const row = dividers[0].parentElement!;
    expect(row.children).toHaveLength(3);
    expect(row.children[1]).toBe(dividers[0]);
  });

  it('draws no hairline for a lone stat', () => {
    render(<ProductStatPair>{stat('Current Rate')}</ProductStatPair>);

    expect(screen.queryAllByTestId('product-stat-divider')).toHaveLength(0);
  });

  it('halves the row only when grow is set — the supply card pair stays content-width', () => {
    const { container: content } = render(
      <ProductStatPair>
        {stat('a')}
        {stat('b')}
      </ProductStatPair>
    );
    expect(content.firstElementChild!.className).not.toContain('[&>div]:flex-1');

    const { container: grown } = render(
      <ProductStatPair grow>
        {stat('a')}
        {stat('b')}
      </ProductStatPair>
    );
    expect(grown.firstElementChild!.className).toContain('[&>div]:flex-1');
  });
});

describe('ProductStat', () => {
  it('puts the value in a div, so a Skeleton (a div) can sit in that slot', () => {
    render(
      <ProductStat label="Rewards rate">
        <div data-testid="skeleton" />
      </ProductStat>
    );

    // The slot itself is the assertion — a span here would make the Skeleton
    // invalid markup (a div inside a span).
    expect(screen.getByTestId('skeleton').parentElement?.tagName).toBe('DIV');
  });
});
