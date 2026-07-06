import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSparkSavingsUrl, fetchSparkSavingsCurrent, fetchSparkSavingsHistoric } from './sparkSavingsApi';
import { SPARK_SAVINGS_API_HOST, SPARK_VAULT_IDENTITY } from './constants';

describe('buildSparkSavingsUrl', () => {
  it('builds the current-endpoint path from the vault token and the default host', () => {
    expect(buildSparkSavingsUrl(SPARK_VAULT_IDENTITY)).toBe(`${SPARK_SAVINGS_API_HOST}/vaults/savings/usdt`);
  });

  it('builds the URL from a configured host (a host swap is a one-arg change)', () => {
    expect(buildSparkSavingsUrl(SPARK_VAULT_IDENTITY, { host: 'https://api.sky.money' })).toBe(
      'https://api.sky.money/vaults/savings/usdt'
    );
  });

  it('strips trailing slashes from the host', () => {
    expect(buildSparkSavingsUrl(SPARK_VAULT_IDENTITY, { host: 'https://proxy.test/' })).toBe(
      'https://proxy.test/vaults/savings/usdt'
    );
  });

  it('appends /historic when requested', () => {
    expect(buildSparkSavingsUrl(SPARK_VAULT_IDENTITY, { historic: true })).toBe(
      `${SPARK_SAVINGS_API_HOST}/vaults/savings/usdt/historic`
    );
  });
});

describe('fetchSparkSavingsCurrent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the URL built from the configured host and returns the parsed payload', async () => {
    const payload = { data: { apy: '0', tvl: '1' } };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await fetchSparkSavingsCurrent(SPARK_VAULT_IDENTITY, 'https://proxy.test');

    expect(fetchSpy).toHaveBeenCalledWith('https://proxy.test/vaults/savings/usdt');
    expect(result).toEqual(payload);
  });

  it('throws on a non-OK response so the hook can surface a clean error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));

    await expect(fetchSparkSavingsCurrent(SPARK_VAULT_IDENTITY)).rejects.toThrow(
      'Spark Savings API error: 503'
    );
  });
});

describe('fetchSparkSavingsHistoric', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the /historic URL built from the configured host and returns the parsed payload', async () => {
    const payload = { data: [{ date: '2026-06-01T00:00:00.000Z', apy: '0', tvl: '1' }] };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await fetchSparkSavingsHistoric(SPARK_VAULT_IDENTITY, 'https://proxy.test');

    expect(fetchSpy).toHaveBeenCalledWith('https://proxy.test/vaults/savings/usdt/historic');
    expect(result).toEqual(payload);
  });

  it('throws on a non-OK response so the caller can surface a clean error state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));

    await expect(fetchSparkSavingsHistoric(SPARK_VAULT_IDENTITY)).rejects.toThrow(
      'Spark Savings API error: 503'
    );
  });
});
