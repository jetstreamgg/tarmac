import { beforeEach, describe, expect, it } from 'vitest';
import { recallEarnFilterSearch, rememberEarnFilterSearch } from './earnFilterMemory';

describe('earnFilterMemory', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips the Earn filter params', () => {
    rememberEarnFilterSearch({ token: 'usdc', chain: 'base', product: 'savings' });
    expect(recallEarnFilterSearch()).toEqual({ token: 'usdc', chain: 'base', product: 'savings' });
  });

  it('keeps only the filter params, so the network override never rides along', () => {
    rememberEarnFilterSearch({ token: 'usdc', network: 'base', geo_mode: 'full' });
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
