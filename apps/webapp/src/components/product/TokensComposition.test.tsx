import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokensComposition } from './TokensComposition';

afterEach(cleanup);

const segments = [
  { id: 'a', label: 'stUSDS', color: '#E7A6C4', value: 75, formattedValue: '$19.92M' },
  { id: 'b', label: 'sUSDS', color: '#59D6B8', value: 25, formattedValue: '$10.14M' }
];

describe('TokensComposition', () => {
  it('renders the title, total and each token row', () => {
    render(<TokensComposition title="Strategy" total="$30.04M" segments={segments} />);
    expect(screen.getByText('Strategy')).toBeTruthy();
    expect(screen.getByText('$30.04M')).toBeTruthy();
    expect(screen.getByText('stUSDS')).toBeTruthy();
    expect(screen.getByText('sUSDS')).toBeTruthy();
  });

  it('derives each percentage from the value share of the total', () => {
    render(<TokensComposition segments={segments} />);
    expect(screen.getByText('(75%)')).toBeTruthy();
    expect(screen.getByText('(25%)')).toBeTruthy();
  });

  it('honours an explicit percent override', () => {
    render(<TokensComposition segments={[{ ...segments[0], percent: 59 }]} />);
    expect(screen.getByText('(59%)')).toBeTruthy();
  });

  it('orders the legend by amount descending while the bar keeps the caller order', () => {
    render(
      <TokensComposition
        segments={[
          { id: 'small', label: 'small', color: '#000', value: 10, formattedValue: '$10M' },
          { id: 'big', label: 'big', color: '#111', value: 90, formattedValue: '$90M' }
        ]}
      />
    );

    const rows = screen.getAllByTestId('composition-row');
    expect(rows.map(row => row.textContent?.startsWith('big'))).toEqual([true, false]);
    // The bar is untouched — idle capital stays at the tail there.
    const bar = screen.getAllByTestId('composition-segment');
    expect(bar[0].style.flex).toBe('10 0 0px');
  });

  it('adds a track-colored tail when the segments fall short of the total', () => {
    render(<TokensComposition segments={[segments[0]]} valueTotal={100} />);
    // One filled segment plus the remainder tail, together summing to 100.
    const bar = screen.getAllByTestId('composition-segment');
    expect(bar).toHaveLength(1);
    expect(bar[0].style.flex).toBe('75 0 0px');
  });

  it('reveals the hovered row detail and dims the other bar segments', () => {
    render(
      <TokensComposition
        segments={[{ ...segments[0], hoverDetail: <span>Absolute Cap</span> }, segments[1]]}
      />
    );

    expect(screen.queryByText('Absolute Cap')).toBeNull();

    fireEvent.mouseEnter(screen.getAllByTestId('composition-row')[0]);

    expect(screen.getByText('Absolute Cap')).toBeTruthy();
    const bar = screen.getAllByTestId('composition-segment');
    expect(bar[0].className).not.toContain('opacity-20');
    expect(bar[1].className).toContain('opacity-20');
  });

  it('links the hovered label when the segment carries an href', () => {
    render(<TokensComposition segments={[{ ...segments[0], href: 'https://example.com/market' }]} />);

    expect(screen.queryByRole('link')).toBeNull();

    fireEvent.mouseEnter(screen.getAllByTestId('composition-row')[0]);

    expect(screen.getByRole('link').getAttribute('href')).toBe('https://example.com/market');
  });
});
