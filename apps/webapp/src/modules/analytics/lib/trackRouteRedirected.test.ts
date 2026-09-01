import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackRouteRedirected } from './trackRouteRedirected';
import { capturedEventsNamed, clearCapturedEvents } from '@/test/analyticsCapture';

vi.mock('../PostHogProvider', () => ({ POSTHOG_ENABLED: true }));

describe('trackRouteRedirected', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Past the dedupe window of whatever the previous test emitted.
    vi.setSystemTime(vi.getRealSystemTime());
    vi.advanceTimersByTime(1000);
    clearCapturedEvents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('captures the event with the redirect envelope', () => {
    trackRouteRedirected({ fromPath: '/earn/fixed/bogus', toPath: '/earn', reason: 'unknown_market' });

    const events = capturedEventsNamed('app_route_redirected');
    expect(events).toHaveLength(1);
    expect(events[0].properties).toMatchObject({
      from_path: '/earn/fixed/bogus',
      to_path: '/earn',
      reason: 'unknown_market',
      viewport: expect.any(String)
    });
  });

  it('drops an identical emission inside the dedupe window (StrictMode double-run)', () => {
    trackRouteRedirected({ fromPath: '/stake', toPath: '/portfolio', reason: 'module_unavailable' });
    vi.advanceTimersByTime(50);
    trackRouteRedirected({ fromPath: '/stake', toPath: '/portfolio', reason: 'module_unavailable' });

    expect(capturedEventsNamed('app_route_redirected')).toHaveLength(1);
  });

  it('emits again outside the window or for a different redirect', () => {
    trackRouteRedirected({ fromPath: '/convert', toPath: '/portfolio', reason: 'module_unavailable' });
    trackRouteRedirected({ fromPath: '/convert', toPath: '/earn/rewards', reason: 'unknown_reward' });
    vi.advanceTimersByTime(600);
    trackRouteRedirected({ fromPath: '/convert', toPath: '/portfolio', reason: 'module_unavailable' });

    expect(capturedEventsNamed('app_route_redirected')).toHaveLength(3);
  });
});
