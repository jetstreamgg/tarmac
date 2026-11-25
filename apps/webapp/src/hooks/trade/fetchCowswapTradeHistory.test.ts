import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'wagmi/chains';
import { fetchCowswapTradeHistory } from './useCowswapTradeHistory';
import { OrderStatus, SKY_MONEY_APP_CODE } from './constants';
import { getTokensForChain } from '../tokens/tokens.constants';
import { TENDERLY_CHAIN_ID } from '../constants';

const OWNER = '0x1111111111111111111111111111111111111111';
const tokens = getTokensForChain(mainnet.id);
const usds = tokens.find(token => token.symbol === 'USDS')!;
const usdc = tokens.find(token => token.symbol === 'USDC')!;

function jsonResponse(body: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    uid: '0xorder',
    owner: OWNER,
    creationDate: '2026-10-01T00:00:00.000Z',
    sellToken: usds.address,
    buyToken: usdc.address,
    sellAmount: '100',
    buyAmount: '99',
    executedSellAmount: '100',
    executedBuyAmount: '98',
    status: OrderStatus.fulfilled,
    fullAppData: JSON.stringify({ appCode: SKY_MONEY_APP_CODE }),
    ...overrides
  };
}

describe('fetchCowswapTradeHistory', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs the owner orders from the chain endpoint, without a preflight-triggering header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await fetchCowswapTradeHistory(mainnet.id, OWNER, 25, tokens);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`https://api.cow.fi/mainnet/api/v1/account/${OWNER}/orders?limit=25`);
    expect(init).toBeUndefined();
  });

  it('reads Tenderly history from the mainnet endpoint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    await fetchCowswapTradeHistory(TENDERLY_CHAIN_ID, OWNER, 50, tokens);

    expect(String(fetchMock.mock.calls[0][0]).startsWith('https://api.cow.fi/mainnet/')).toBe(true);
  });

  it('returns no history without an address, and throws for an unsupported chain', async () => {
    await expect(fetchCowswapTradeHistory(mainnet.id, undefined, 50, tokens)).resolves.toEqual([]);
    await expect(fetchCowswapTradeHistory(10, OWNER, 50, tokens)).rejects.toThrow(
      'CowSwap API not configured for chain 10'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws on a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errorType: 'InvalidLimit' }, { status: 400 }));

    await expect(fetchCowswapTradeHistory(mainnet.id, OWNER, 50, tokens)).rejects.toThrow(
      'CowSwap orders error: 400'
    );
  });

  it('throws a clear error when a 200 body is not an order list', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));

    await expect(fetchCowswapTradeHistory(mainnet.id, OWNER, 50, tokens)).rejects.toThrow(
      `Failed to fetch orders for ${OWNER}: unexpected response`
    );
  });

  it('keeps only sky.money orders between supported tokens, using executed amounts once fulfilled', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        order(),
        order({ uid: '0xopen', status: OrderStatus.open }),
        order({ uid: '0xother-app', fullAppData: JSON.stringify({ appCode: 'CoW Swap' }) }),
        order({ uid: '0xunknown-token', buyToken: '0x2222222222222222222222222222222222222222' })
      ])
    );

    const history = await fetchCowswapTradeHistory(mainnet.id, OWNER, 50, tokens);

    expect(history?.map(item => item.id)).toEqual(['0xorder', '0xopen']);
    expect(history?.[0]).toMatchObject({ fromAmount: 100n, toAmount: 98n, chainId: mainnet.id });
    expect(history?.[1]).toMatchObject({ fromAmount: 100n, toAmount: 99n });
  });
});
