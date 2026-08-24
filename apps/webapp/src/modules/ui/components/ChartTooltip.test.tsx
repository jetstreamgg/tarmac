import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';

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

// On touch there is no mouseleave, so without this a tapped tooltip outlives
// the tap and rides the fixed portal layer away from the chart while the page
// scrolls. Dismissal is a synthesized mouseleave on the recharts wrapper — the
// one event recharts clears its hover store from.
describe('ChartTooltip — dismissal', () => {
  // Mirrors the live DOM the hook navigates: the plot box (anchorRef) hosting
  // recharts' own wrapper div, whose React onMouseLeave recharts listens on.
  const Harness = ({ onLeave, active = true }: { onLeave: () => void; active?: boolean }) => {
    const anchorRef = useRef<HTMLDivElement>(null);
    return (
      <div ref={anchorRef} data-testid="plot">
        <div className="recharts-wrapper" onMouseLeave={onLeave} />
        <ChartTooltip {...base} active={active} coordinate={{ x: 10, y: 10 }} anchorRef={anchorRef} />
      </div>
    );
  };

  it('scrolling dismisses the hover via a wrapper mouseleave', () => {
    const onLeave = vi.fn();
    render(<Harness onLeave={onLeave} />);
    fireEvent.scroll(window);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('a press outside the plot dismisses the hover', () => {
    const onLeave = vi.fn();
    render(<Harness onLeave={onLeave} />);
    fireEvent.pointerDown(document.body);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('a press inside the plot does not dismiss (a new tap re-scrubs instead)', () => {
    const onLeave = vi.fn();
    render(<Harness onLeave={onLeave} />);
    fireEvent.pointerDown(screen.getByTestId('plot'));
    expect(onLeave).not.toHaveBeenCalled();
  });

  // Recharts keeps the content component mounted (and the last coordinate)
  // while inactive, so resuming a hover on the same snapped point remounts the
  // panel with identical x/y — which used to skip the follower's coordinate-
  // keyed placement and leave the card visible at the screen's top-left.
  it('re-places a remounted panel whose coordinate has not changed', () => {
    const anchorRef = { current: document.createElement('div') };
    const props = { ...base, coordinate: { x: 100, y: 50 }, anchorRef };
    const { rerender } = render(<ChartTooltip {...props} />);
    const before = screen.getByTestId('chart-tooltip').style.transform;
    expect(before).toMatch(/translate/);
    rerender(<ChartTooltip {...props} active={false} />);
    expect(screen.queryByTestId('chart-tooltip')).toBeNull();
    rerender(<ChartTooltip {...props} />);
    expect(screen.getByTestId('chart-tooltip').style.transform).toBe(before);
  });

  it('detaches its listeners once inactive', () => {
    const onLeave = vi.fn();
    const { rerender } = render(<Harness onLeave={onLeave} />);
    rerender(<Harness onLeave={onLeave} active={false} />);
    fireEvent.scroll(window);
    expect(onLeave).not.toHaveBeenCalled();
  });
});
