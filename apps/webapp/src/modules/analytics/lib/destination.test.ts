import { afterEach, describe, expect, it } from 'vitest';
import type { CaptureResult } from 'posthog-js';
import { destinationFromPathname, setUpgradeModalOpen, stampDestination } from './destination';

const eventAt = (pathname: string, properties: Record<string, unknown> = {}): CaptureResult => {
  window.history.replaceState(null, '', pathname);
  return { event: 'test_event', properties } as unknown as CaptureResult;
};

afterEach(() => setUpgradeModalOpen(false));

describe('destinationFromPathname', () => {
  it('maps section roots and nested paths', () => {
    expect(destinationFromPathname('/portfolio')).toBe('portfolio');
    expect(destinationFromPathname('/earn')).toBe('earn');
    expect(destinationFromPathname('/earn/savings')).toBe('earn');
    expect(destinationFromPathname('/earn/fixed/some-market')).toBe('earn');
    expect(destinationFromPathname('/stake')).toBe('stake');
    expect(destinationFromPathname('/convert/psm')).toBe('convert');
  });

  it('returns undefined off-section', () => {
    expect(destinationFromPathname('/')).toBeUndefined();
    expect(destinationFromPathname('/seal-engine')).toBeUndefined();
    expect(destinationFromPathname('/earnings')).toBeUndefined();
  });
});

describe('stampDestination (before_send)', () => {
  it('stamps the current section onto event properties', () => {
    const event = eventAt('/earn/savings', { existing: 1 });
    const result = stampDestination(event);
    expect(result?.properties).toMatchObject({ existing: 1, destination: 'earn' });
  });

  it('leaves properties unstamped off-section', () => {
    const result = stampDestination(eventAt('/seal-engine'));
    expect(result?.properties).not.toHaveProperty('destination');
  });

  it('reports upgrade while the upgrade modal is open, wherever the URL sits', () => {
    setUpgradeModalOpen(true);
    expect(stampDestination(eventAt('/stake'))?.properties).toMatchObject({ destination: 'upgrade' });
    setUpgradeModalOpen(false);
    expect(stampDestination(eventAt('/stake'))?.properties).toMatchObject({ destination: 'stake' });
  });

  it('passes a rejected (null) event through untouched', () => {
    expect(stampDestination(null)).toBeNull();
  });
});
