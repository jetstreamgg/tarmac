/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { SEND_INTENT_MS, clearSendIntent, markSendIntent, recentSendIntents } from './sendIntentStore';

const NOW = 1_800_000_000_000;

describe('sendIntentStore', () => {
  beforeEach(() => localStorage.clear());

  it('keeps a signature asked for per scope and network until cleared', () => {
    markSendIntent('a', 'arbitrum', NOW);
    markSendIntent('a', 'base', NOW + 1);
    expect(recentSendIntents('a', NOW + 2)).toEqual([
      { network: 'arbitrum', at: NOW },
      { network: 'base', at: NOW + 1 }
    ]);
    expect(recentSendIntents('b', NOW + 2)).toEqual([]);
    clearSendIntent('a', 'arbitrum', NOW);
    expect(recentSendIntents('a', NOW + 2)).toEqual([{ network: 'base', at: NOW + 1 }]);
  });

  it("keeps a later Confirm's signature when an earlier one clears", () => {
    markSendIntent('a', 'arbitrum', NOW);
    markSendIntent('a', 'arbitrum', NOW + 1);
    clearSendIntent('a', 'arbitrum', NOW);
    expect(recentSendIntents('a', NOW + 2)).toEqual([{ network: 'arbitrum', at: NOW + 1 }]);
  });

  it('keeps each signature asked for on one network until it clears', () => {
    markSendIntent('a', 'arbitrum', NOW);
    markSendIntent('a', 'arbitrum', NOW + 1);
    clearSendIntent('a', 'arbitrum', NOW + 1);
    expect(recentSendIntents('a', NOW + 2)).toEqual([{ network: 'arbitrum', at: NOW }]);
  });

  it('forgets a signature older than the window', () => {
    markSendIntent('a', 'arbitrum', NOW);
    expect(recentSendIntents('a', NOW + SEND_INTENT_MS - 1)).toHaveLength(1);
    expect(recentSendIntents('a', NOW + SEND_INTENT_MS)).toEqual([]);
  });

  it("keeps a burn's amount, and drops one that isn't a whole number", () => {
    markSendIntent('a', 'base', NOW, 1_000_000n);
    expect(recentSendIntents('a', NOW)).toEqual([{ network: 'base', at: NOW, burnAmount: '1000000' }]);
    localStorage.setItem(
      'bridgeSendIntent:v1:a',
      JSON.stringify([{ network: 'base', at: NOW, burnAmount: '1e6' }])
    );
    expect(recentSendIntents('a', NOW)).toEqual([]);
  });

  it('reads nothing from a corrupt entry', () => {
    localStorage.setItem('bridgeSendIntent:v1:a', 'not json');
    expect(recentSendIntents('a', NOW)).toEqual([]);
    localStorage.setItem('bridgeSendIntent:v1:a', JSON.stringify({ base: NOW }));
    expect(recentSendIntents('a', NOW)).toEqual([]);
    localStorage.setItem('bridgeSendIntent:v1:a', JSON.stringify([{ network: 'base', at: 'x' }, null]));
    expect(recentSendIntents('a', NOW)).toEqual([]);
  });
});
