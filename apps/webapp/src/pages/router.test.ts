import { afterEach, describe, it, expect, vi } from 'vitest';
import { mainnet } from 'viem/chains';
import { susdtRedirectLoader } from './router';
import { sparkUsdtVaultAddress } from '@/hooks';

describe('susdtRedirectLoader', () => {
  // The suite defaults VITE_SUSDT_VAULT_ENABLED on (staging contract), so the
  // statically-imported loader exercises the flag-on path.
  it('redirects /susdt to the canonical sUSDT vault deep-link when the flag is on', () => {
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

  // The flag is read at module load, so stub the env and re-import to re-evaluate it.
  describe('when the sUSDT feature flag is off (APP-323)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it('redirects /susdt to the app root instead of the now-unresolvable vault deep-link', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_SUSDT_VAULT_ENABLED', 'false');
      const { susdtRedirectLoader: gatedLoader } = await import('./router');

      const response = gatedLoader() as Response;

      expect(response.status).toBe(302);

      const url = new URL(response.headers.get('Location') as string, 'https://app.sky.money');
      expect(url.pathname).toBe('/');
      // No vault deep-link params — the vault is hidden, so /susdt must not point at it.
      expect(url.searchParams.get('vault')).toBeNull();
      expect(url.searchParams.get('widget')).toBeNull();
      expect(url.searchParams.get('vault_module')).toBeNull();
    });
  });
});
