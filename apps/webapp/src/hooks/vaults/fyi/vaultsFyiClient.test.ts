import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchVaultsFyiPartialReturns, fetchVaultsFyiTotalReturns } from './vaultsFyiClient';
import { VAULTS_FYI_API_URL } from './constants';

const USER = '0x8583F4B8697D4FF34E5CD05100DCDD6EA7040225' as const;
const VAULT = '0xA3931d71877C0E7a3148CB7Eb4463524FEc27fbD' as const;

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('fetchVaultsFyiTotalReturns', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hits the exact proxied path with lowercased addresses and no query params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ returnsNative: '0' }));

    await fetchVaultsFyiTotalReturns({ userAddress: USER, vaultId: VAULT });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The /mainnet/ segment is hardcoded: APP-450 earned figures are
    // mainnet-only scope regardless of the connected network.
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${VAULTS_FYI_API_URL}/v2/portfolio/total-returns/${USER.toLowerCase()}/mainnet/${VAULT.toLowerCase()}`
    );
  });

  it('returns the payload as-is (flat object, not wrapped)', async () => {
    const payload = {
      address: '0xdc035d45d973e3ec169d2276ddab16f1e407384f',
      symbol: 'USDS',
      decimals: 18,
      returnsNative: '46400000000000000000',
      assetPriceInUsd: '0.9998'
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const out = await fetchVaultsFyiTotalReturns({ userAddress: USER, vaultId: VAULT });

    expect(out).toEqual(payload);
  });

  it('throws with the status code on non-2xx responses (401/402 are the keyless states)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, { status: 401 }));

    await expect(fetchVaultsFyiTotalReturns({ userAddress: USER, vaultId: VAULT })).rejects.toThrow('401');
  });
});

describe('fetchVaultsFyiPartialReturns', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hits the exact beta path with fromTimestamp as the only query param', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ returnsNative: '0' }));

    await fetchVaultsFyiPartialReturns({ userAddress: USER, vaultId: VAULT, fromTimestamp: 1754006400 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // No toTimestamp: the window end is "now", which is the API default.
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${VAULTS_FYI_API_URL}/beta/portfolio/partial-returns/${USER.toLowerCase()}/mainnet/${VAULT.toLowerCase()}?fromTimestamp=1754006400`
    );
  });

  it('returns the payload as-is including the resolved period boundaries', async () => {
    const payload = {
      symbol: 'USDS',
      decimals: 18,
      returnsNative: '5000000000000000000',
      assetPriceInUsd: '1',
      fromTimestamp: 1754006400,
      toTimestamp: 1755600000
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const out = await fetchVaultsFyiPartialReturns({
      userAddress: USER,
      vaultId: VAULT,
      fromTimestamp: 1754006400
    });

    expect(out).toEqual(payload);
  });

  it('throws with the status code on non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, { status: 502 }));

    await expect(
      fetchVaultsFyiPartialReturns({ userAddress: USER, vaultId: VAULT, fromTimestamp: 1754006400 })
    ).rejects.toThrow('502');
  });
});
