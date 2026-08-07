import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/routes';
import { rememberEarnFilterSearch } from '@/lib/earnFilterMemory';
import { backToMarketplace } from './ProductDetailTemplate';

// The back link is a push, not history.back() — a traversal gets no view
// transition — so it has to be told which filters to restore (APP-457).
describe('backToMarketplace', () => {
  beforeEach(() => sessionStorage.clear());

  it('carries the remembered filters back to the marketplace', () => {
    rememberEarnFilterSearch({ token: 'usdc', product: 'savings' });
    expect(backToMarketplace(ROUTES.EARN)).toBe('/earn?token=usdc&product=savings');
  });

  it('stays a bare path when the marketplace was last seen unfiltered', () => {
    rememberEarnFilterSearch({});
    expect(backToMarketplace(ROUTES.EARN)).toBe(ROUTES.EARN);
  });

  it('stays a bare path when nothing was ever recorded', () => {
    expect(backToMarketplace(ROUTES.EARN)).toBe(ROUTES.EARN);
  });

  it('leaves every other back destination untouched', () => {
    rememberEarnFilterSearch({ token: 'usdc' });
    // Portfolio and Stake render through this template too; only Earn has
    // filters to restore.
    expect(backToMarketplace(ROUTES.PORTFOLIO)).toBe(ROUTES.PORTFOLIO);
    expect(backToMarketplace(ROUTES.STAKE)).toBe(ROUTES.STAKE);
  });

  it('encodes values rather than pasting them into the query', () => {
    rememberEarnFilterSearch({ token: 'us dc&x=1' });
    expect(backToMarketplace(ROUTES.EARN)).toBe('/earn?token=us+dc%26x%3D1');
  });
});
