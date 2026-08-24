import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MORPHO_API_URL, USER_VAULT_V2_PNL_QUERY, VAULT_V2_TRANSACTIONS_SINCE_QUERY } from './constants';
import { fetchUserVaultV2Pnl, fetchVaultV2TransactionsSince } from './morphoPnlClient';

const USER = '0x1111111111111111111111111111111111111111' as const;
const VAULT = '0xE15fcC81118895b67b6647BBd393182dF44E11E0';

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('morphoPnlClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchUserVaultV2Pnl', () => {
    it('POSTs the pnl document with user, chain, and window variables', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { userByAddress: { vaultV2Positions: [] } } }));

      await fetchUserVaultV2Pnl({
        userAddress: USER,
        chainId: 1,
        startTimestamp: 1785542400,
        endTimestamp: 1787140800
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(MORPHO_API_URL);
      const body = JSON.parse(init.body);
      expect(body.query).toBe(USER_VAULT_V2_PNL_QUERY);
      expect(body.variables).toEqual({
        userAddress: USER,
        chainId: 1,
        startTimestamp: 1785542400,
        endTimestamp: 1787140800
      });
    });

    it('returns the positions array untouched', async () => {
      const position = {
        vault: { address: VAULT, asset: { symbol: 'USDS', decimals: 18 } },
        assets: '0',
        assetsUsd: 0,
        pnl: '875057747029463685691',
        pnlUsd: 875.09,
        roe: 0.0016,
        history: { assets: [{ x: 1785542400, y: '200080001947584340947422' }] }
      };
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { userByAddress: { vaultV2Positions: [position] } } })
      );

      const out = await fetchUserVaultV2Pnl({
        userAddress: USER,
        chainId: 1,
        startTimestamp: 0,
        endTimestamp: 1
      });
      expect(out).toEqual([position]);
    });

    it('returns [] when the wallet is unknown to Morpho (userByAddress null)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { userByAddress: null } }));
      const out = await fetchUserVaultV2Pnl({
        userAddress: USER,
        chainId: 1,
        startTimestamp: 0,
        endTimestamp: 1
      });
      expect(out).toEqual([]);
    });

    it('throws with the status code on non-2xx responses (so the hook can degrade)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));
      await expect(
        fetchUserVaultV2Pnl({ userAddress: USER, chainId: 1, startTimestamp: 0, endTimestamp: 1 })
      ).rejects.toThrow('500');
    });

    it('throws when the response carries GraphQL errors instead of data', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'boom' }] }));
      await expect(
        fetchUserVaultV2Pnl({ userAddress: USER, chainId: 1, startTimestamp: 0, endTimestamp: 1 })
      ).rejects.toThrow();
    });
  });

  describe('fetchVaultV2TransactionsSince', () => {
    it('POSTs the since-document scoped to vaults and window start', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { vaultV2transactions: { items: [] } } }));

      await fetchVaultV2TransactionsSince({
        userAddress: USER,
        chainId: 1,
        vaultAddresses: [VAULT],
        sinceTimestamp: 1785542400
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(MORPHO_API_URL);
      const body = JSON.parse(init.body);
      expect(body.query).toBe(VAULT_V2_TRANSACTIONS_SINCE_QUERY);
      expect(body.query).toContain('timestamp_gte');
      expect(body.variables).toEqual({
        userAddress: USER,
        chainId: 1,
        vaultAddresses: [VAULT],
        sinceTimestamp: 1785542400
      });
    });

    it('returns the transaction items untouched', async () => {
      const item = {
        vault: { address: VAULT, asset: { symbol: 'USDS', decimals: 18 } },
        type: 'Deposit',
        timestamp: 1785550643,
        txHash: '0xabc',
        data: { assets: '149999475611846509621144' }
      };
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { vaultV2transactions: { items: [item] } } }));

      const out = await fetchVaultV2TransactionsSince({
        userAddress: USER,
        chainId: 1,
        vaultAddresses: [VAULT],
        sinceTimestamp: 0
      });
      expect(out).toEqual([item]);
    });

    it('throws with the status code on non-2xx responses', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 502 }));
      await expect(
        fetchVaultV2TransactionsSince({
          userAddress: USER,
          chainId: 1,
          vaultAddresses: [VAULT],
          sinceTimestamp: 0
        })
      ).rejects.toThrow('502');
    });
  });
});
