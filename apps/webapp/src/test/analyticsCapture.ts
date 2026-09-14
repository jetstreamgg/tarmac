import posthog from 'posthog-js';
import type { Mock } from 'vitest';
import type { AppEventContract, AppEventName } from '@/modules/analytics/contract';

/**
 * Typed inspection helpers over the global posthog-js mock (see setup.ts).
 * Test files whose code under test reads the client via `usePostHog()` must
 * also alias it to the mock:
 *
 *   vi.mock('posthog-js/react', async () => {
 *     const posthog = (await import('posthog-js')).default;
 *     return { usePostHog: () => posthog };
 *   });
 */

export interface CapturedEvent<K extends AppEventName = AppEventName> {
  name: K;
  properties: Partial<AppEventContract[K]> & Record<string, unknown>;
}

const captureMock = () => posthog.capture as unknown as Mock;

export function capturedEvents(): CapturedEvent[] {
  return captureMock().mock.calls.map(([name, properties]) => ({
    name: name as AppEventName,
    properties: (properties ?? {}) as CapturedEvent['properties']
  }));
}

export function capturedEventsNamed<K extends AppEventName>(name: K): CapturedEvent<K>[] {
  return capturedEvents().filter((event): event is CapturedEvent<K> => event.name === name);
}

export function lastCapturedEvent<K extends AppEventName>(name: K): CapturedEvent<K> | undefined {
  return capturedEventsNamed(name).at(-1);
}

export function clearCapturedEvents(): void {
  captureMock().mockClear();
}
