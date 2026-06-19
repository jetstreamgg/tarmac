import { describe, it, expect } from 'vitest';
import { mainnet } from 'viem/chains';
import { susdtRedirectLoader } from './router';
import { sparkUsdtVaultAddress } from '@/hooks';

describe('susdtRedirectLoader', () => {
  it('redirects /susdt to the canonical sUSDT vault deep-link', () => {
    const response = susdtRedirectLoader() as Response;

    expect(response.status).toBe(302);

    const location = response.headers.get('Location');
    expect(location).not.toBeNull();

    const url = new URL(location as string, 'https://app.sky.money');
    expect(url.pathname).toBe('/');

    const params = url.searchParams;
    expect(params.get('network')).toBe('ethereum');
    expect(params.get('widget')).toBe('vaults');
    expect(params.get('vault_module')).toBe('sky');
    expect(params.get('vault')).toBe(sparkUsdtVaultAddress[mainnet.id]);
  });
});
