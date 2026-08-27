import { beforeEach, describe, expect, it } from 'vitest';
import { recallEarnFilterSearch, rememberEarnFilterSearch } from './earnFilterMemory';

describe('earnFilterMemory', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips the Earn filter params', () => {
    rememberEarnFilterSearch({ token: 'usdc', product: 'savings' });
    expect(recallEarnFilterSearch()).toEqual({ token: 'usdc', product: 'savings' });
  });

  it('keeps only the URL filter params — network is not one of them', () => {
    // `chain` was the Earn network filter until it became the app-wide one
    // (lib/networkFilter), which survives on its own; `network` is the wallet's
    // chain and must never ride a "restore my filters" link.
    rememberEarnFilterSearch({ token: 'usdc', chain: 'base', network: 'base', geo_mode: 'full' });
    expect(recallEarnFilterSearch()).toEqual({ token: 'usdc' });
  });

  it('reads empty before anything is recorded', () => {
    expect(recallEarnFilterSearch()).toEqual({});
  });

  it('wipes what it held when the marketplace is seen unfiltered', () => {
    rememberEarnFilterSearch({ token: 'usdc' });
    rememberEarnFilterSearch({});
    expect(recallEarnFilterSearch()).toEqual({});
  });

  it('survives corrupt storage', () => {
    sessionStorage.setItem('earnFilterSearch', '{not json');
    expect(recallEarnFilterSearch()).toEqual({});
  });
});
