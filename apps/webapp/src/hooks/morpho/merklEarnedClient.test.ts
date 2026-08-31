import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MERKL_API_URL } from './constants';
import { fetchMerklClaims, fetchMerklUserRewards } from './merklEarnedClient';

const USER = '0x1111111111111111111111111111111111111111' as const;

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('merklEarnedClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchMerklUserRewards', () => {
    it('GETs the rewards endpoint WITHOUT claimableOnly (claimed history must be included)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await fetchMerklUserRewards({ userAddress: USER, chainId: 1 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toBe(`${MERKL_API_URL}/users/${USER}/rewards?chainId=1`);
      expect(url).not.toContain('claimableOnly');
    });

    it('returns the rewards of the requested chain untouched', async () => {
      const reward = {
        root: '0xroot',
        recipient: USER,
        amount: '8456476888702806112973',
        claimed: '8446886856555209102563',
        pending: '0',
        token: { address: '0xdC03', chainId: 1, symbol: 'USDS', decimals: 18, price: 0.9999 },
        breakdowns: [{ reason: 'ERC20_0xE15f', amount: '1', claimed: '0', pending: '0', campaignId: '0x1' }]
      };
      fetchMock.mockResolvedValueOnce(
        jsonResponse([
          { chain: { id: 42161 }, rewards: [{ ...reward, amount: 'wrong-chain' }] },
          { chain: { id: 1 }, rewards: [reward] }
        ])
      );

      const out = await fetchMerklUserRewards({ userAddress: USER, chainId: 1 });
      expect(out).toEqual([reward]);
    });

    it('returns [] when the response has no entry for the chain', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));
      const out = await fetchMerklUserRewards({ userAddress: USER, chainId: 1 });
      expect(out).toEqual([]);
    });

    it('throws with the status code on non-2xx responses (so the hook can degrade)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 500 }));
      await expect(fetchMerklUserRewards({ userAddress: USER, chainId: 1 })).rejects.toThrow('500');
    });
  });

  describe('fetchMerklClaims', () => {
    it('GETs the claims endpoint keyed by recipient (user/userAddress are invalid params)', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await fetchMerklClaims({ userAddress: USER, chainId: 1 });

      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toBe(`${MERKL_API_URL}/claims?recipient=${USER}&chainId=1`);
    });

    it('returns the claim rows untouched', async () => {
      const claim = {
        id: '1-0xabc',
        chainId: 1,
        timestamp: 1786666223,
        token: '0xdC035D45d973E3EC169d2276DDab16f1e407384F',
        reason: 'ERC20_0xE15fcC81118895b67b6647BBd393182dF44E11E0',
        amount: '82655917290921620000'
      };
      fetchMock.mockResolvedValueOnce(jsonResponse([claim]));

      const out = await fetchMerklClaims({ userAddress: USER, chainId: 1 });
      expect(out).toEqual([claim]);
    });

    it('throws with the status code on non-2xx responses', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 502 }));
      await expect(fetchMerklClaims({ userAddress: USER, chainId: 1 })).rejects.toThrow('502');
    });
  });
});
