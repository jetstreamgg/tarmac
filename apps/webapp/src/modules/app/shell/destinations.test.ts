import { describe, it, expect } from 'vitest';
import { DESTINATION_ORDER } from '@/lib/routes';
import { DESTINATIONS } from './destinations';

describe('DESTINATIONS', () => {
  // The router reads DESTINATION_ORDER outside the React tree to decide which
  // way a page transition travels (APP-457). If the two ever disagree, the
  // animation would run against what the nav actually shows.
  it('renders the destinations in the order the router animates them', () => {
    expect(DESTINATIONS.map(destination => destination.path)).toEqual(DESTINATION_ORDER);
  });
});
