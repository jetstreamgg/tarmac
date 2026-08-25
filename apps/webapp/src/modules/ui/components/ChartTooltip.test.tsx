import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartTooltip } from './ChartTooltip';

// TokenIconStack pulls in TokenIcon → useChainId (wagmi), which needs a
// provider. This suite only exercises ChartTooltip's conditional wiring, so
// stub the stack to a plain span that echoes one child per symbol.
vi.mock('./TokenIconStack', () => ({
  TokenIconStack: (props: { symbols: string[]; 'data-testid'?: string }) => (
    <span data-testid={props['data-testid']}>
      {props.symbols.map(symbol => (
        <span key={symbol} data-token={symbol} />
      ))}
    </span>
  )
}));

afterEach(cleanup);

const base = {
  active: true,
  label: new Date('2026-03-12T00:00:00Z'),
  labelFormatter: () => 'Mar 12, 2026',
  tooltipLabel: 'Sky TVL',
  payload: [{ color: '#02C2A1', value: 5774407, payload: {} }]
};

describe('ChartTooltip', () => {
  it('renders the date header and series label', () => {
    render(<ChartTooltip {...base} />);
    expect(screen.getByText('Mar 12, 2026')).toBeTruthy();
    expect(screen.getByText('Sky TVL')).toBeTruthy();
  });

  it('renders nothing when inactive', () => {
    render(<ChartTooltip {...base} active={false} />);
    expect(screen.queryByText('Sky TVL')).toBeNull();
  });

  it('accepts a ReactNode series label (Trans elements from metric pills)', () => {
    render(<ChartTooltip {...base} tooltipLabel={<span>Rate</span>} />);
    expect(screen.getByText('Rate')).toBeTruthy();
  });

  it('omits the series-label cell entirely when no label resolves (no empty gap)', () => {
    render(<ChartTooltip {...base} tooltipLabel={undefined} />);
    expect(screen.queryByTestId('chart-tooltip-series-label')).toBeNull();
    expect(screen.getByText('5,774,407')).toBeTruthy();
  });

  it('renders the trailing token icon for a token series', () => {
    render(<ChartTooltip {...base} tokenSymbols={['sUSDS']} />);
    expect(screen.getByTestId('chart-tooltip-token-icon')).toBeTruthy();
  });

  it('renders one badge per token for a pair series', () => {
    render(<ChartTooltip {...base} tokenSymbols={['USDS', 'DAI']} />);
    expect(screen.getByTestId('chart-tooltip-token-icon').children).toHaveLength(2);
  });

  it('renders no token icon when no symbols are given (e.g. a Rate/% metric)', () => {
    render(<ChartTooltip {...base} tokenSymbols={undefined} />);
    expect(screen.queryByTestId('chart-tooltip-token-icon')).toBeNull();
  });

  it('drops the text symbol suffix when a token icon carries the unit', () => {
    render(<ChartTooltip {...base} symbol="USDS" tokenSymbols={['USDS']} />);
    expect(screen.getByText('5,774,407')).toBeTruthy();
    expect(screen.queryByText(/USDS/)).toBeNull();
  });

  it('keeps the text symbol suffix when there is no token icon', () => {
    render(<ChartTooltip {...base} symbol="USDS" />);
    expect(screen.getByText('5,774,407 USDS')).toBeTruthy();
  });
});

// Portalled out of the chart card, the panel places itself in viewport pixels
// (see the hook's own notes). happy-dom measures every box as zero, so these
// assert the *shape* of the placement — which axis moves, and that a placement
// survives — rather than real pixel values.
describe('ChartTooltip — placement', () => {
  const anchorRef = { current: document.createElement('div') };
  const placed = () => screen.getByTestId('chart-tooltip').style.transform;
  const at = (coordinate: { x: number; y: number }, active = true) => (
    <ChartTooltip {...base} active={active} coordinate={coordinate} anchorRef={anchorRef} />
  );

  /** `translate(<x>px, <y>px)` -> the two components. */
  const axes = (transform: string) => transform.replace(/translate\(|\)|px/g, '').split(', ');

  it('rides one line: x follows the point, y stays pinned to the plot top', () => {
    const { rerender } = render(at({ x: 200, y: 200 }));
    const low = placed();
    // Same point, pointer near the plot's top edge — the panel used to swap to
    // the plot floor here, which is the up-and-down the pin exists to avoid.
    rerender(at({ x: 200, y: 8 }));
    expect(placed()).toBe(low);

    // A fresh mount places outright, so this reads the new x without waiting
    // on the follower's first frame.
    cleanup();
    render(at({ x: 340, y: 8 }));
    const [movedX, movedY] = axes(placed());
    const [restingX, restingY] = axes(low);
    expect(movedX).not.toBe(restingX);
    expect(movedY).toBe(restingY);
  });

  it('stays placed when it remounts at the point it left from', () => {
    const { rerender } = render(at({ x: 200, y: 200 }));
    const before = placed();
    expect(before).not.toBe('');

    // recharts keeps handing over the last coordinate while inactive, so the
    // panel unmounts and comes back with the follower's target unchanged —
    // what happens at the plot's edges, where the pointer leaves and re-enters
    // on the same snapped point. Unplaced, the new node would paint at the
    // top-left corner of the viewport.
    rerender(at({ x: 200, y: 200 }, false));
    expect(screen.queryByTestId('chart-tooltip')).toBeNull();
    rerender(at({ x: 200, y: 200 }));
    expect(placed()).toBe(before);
  });
});
