import { describe, expect, it } from 'vitest';
import { portfolioCallout, portfolioDecision, SIGNIFICANT_BALANCE_USD } from './portfolioCallout';

describe('portfolioCallout', () => {
  it('shows nothing once the earn position clears the floor', () => {
    expect(portfolioCallout(SIGNIFICANT_BALANCE_USD + 0.01, 0)).toBe('none');
    expect(portfolioCallout(1000, 1000)).toBe('none');
  });

  it('pitches allocating when there is no position but idle stablecoins to supply', () => {
    expect(portfolioCallout(0, SIGNIFICANT_BALANCE_USD + 0.01)).toBe('allocate');
    expect(portfolioCallout(SIGNIFICANT_BALANCE_USD, 5000)).toBe('allocate');
  });

  it('falls back to the simulate pitch with no position and nothing idle', () => {
    expect(portfolioCallout(0, 0)).toBe('simulate');
    expect(portfolioCallout(SIGNIFICANT_BALANCE_USD, SIGNIFICANT_BALANCE_USD)).toBe('simulate');
  });
});

describe('portfolioDecision', () => {
  it('lands a small or empty wallet on Idle with its pitch', () => {
    expect(portfolioDecision(0, 5000, false)).toEqual({ outcome: 'allocate', tab: 'idle' });
  });

  it('lands a funded wallet on Supplied', () => {
    expect(portfolioDecision(1000, 0, false)).toEqual({ outcome: 'none', tab: 'supplied' });
  });

  it('sends any matured position to Supplied with no pitch, whatever its size', () => {
    expect(portfolioDecision(0, 5000, true)).toEqual({ outcome: 'none', tab: 'supplied' });
  });
});
