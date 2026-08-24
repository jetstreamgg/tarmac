import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GainValue } from './GainValue';

// APP-450 review finding #8: the sign came from the raw float while the
// magnitude was rounded to cents, so float noise rendered a red "-$0.00" and
// real sub-cent earnings posed as a flat "$0.00".

afterEach(cleanup);

const value = () => screen.getByTestId('gain-value');
const sign = () => value().querySelector('span');

describe('GainValue', () => {
  it('renders a positive value with the green plus', () => {
    render(<GainValue value={557.9} />);
    expect(value().textContent).toBe('+$557.90');
    expect(sign()?.className).toContain('text-bullish');
  });

  it('renders a signed negative with the red minus', () => {
    render(<GainValue value={-29.6} signed />);
    expect(value().textContent).toBe('-$29.60');
    expect(sign()?.className).toContain('text-error');
  });

  it('renders real sub-cent values as <$0.01 instead of $0.00', () => {
    render(<GainValue value={0.002} signed />);
    expect(value().textContent).toBe('+<$0.01');
    expect(sign()?.className).toContain('text-bullish');
  });

  it('keeps the red minus for a real sub-cent loss', () => {
    render(<GainValue value={-0.002} signed />);
    expect(value().textContent).toBe('-<$0.01');
    expect(sign()?.className).toContain('text-error');
  });

  it('collapses negative float noise to a plain +$0.00, never a red -$0.00', () => {
    render(<GainValue value={-1e-13} signed />);
    expect(value().textContent).toBe('+$0.00');
    expect(sign()?.className).toContain('text-bullish');
  });

  it('renders an exact zero as +$0.00', () => {
    render(<GainValue value={0} signed />);
    expect(value().textContent).toBe('+$0.00');
    expect(sign()?.className).toContain('text-bullish');
  });
});
