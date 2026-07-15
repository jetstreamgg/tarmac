import { render, screen, cleanup } from '@testing-library/react';
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
});
