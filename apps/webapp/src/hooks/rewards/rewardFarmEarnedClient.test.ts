import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';

const h = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('graphql-request', () => ({ request: h.request, gql: (s: TemplateStringsArray) => s.join('') }));

import { INDEXER_MAX_QUERY_LIMIT } from '../constants';
import { fetchRewardFarmClaims, fetchRewardFarmEarned } from './rewardFarmEarnedClient';

const USER = '0x1111111111111111111111111111111111111111';
const FARM_A = '0x173e314C7635B45322cd8Cb14f44b312e079F3af';
const FARM_B = '0x4E41488C19cD35EB4de3083Fc3e204854c75c86a';

const row = (i: number) => ({
  amount: String(i),
  blockNumber: String(100 + i),
  blockTimestamp: String(1_000 + i),
  reward: { address: FARM_A }
});

describe('fetchRewardFarmClaims', () => {
  beforeEach(() => h.request.mockReset());

  it('pages past the indexer cap until a short page and parses every row', async () => {
    h.request
      .mockResolvedValueOnce({
        RewardClaim: Array.from({ length: INDEXER_MAX_QUERY_LIMIT }, (_, i) => row(i))
      })
      .mockResolvedValueOnce({ RewardClaim: [row(INDEXER_MAX_QUERY_LIMIT)] });

    const claims = await fetchRewardFarmClaims({
      userAddress: USER,
      farmAddresses: [FARM_A, FARM_B],
      chainId: 1
    });

    expect(claims).toHaveLength(INDEXER_MAX_QUERY_LIMIT + 1);
    expect(claims[0]).toEqual({
      farm: FARM_A.toLowerCase(),
      amount: 0n,
      blockNumber: 100,
      blockTimestamp: 1_000
    });
    expect(h.request).toHaveBeenCalledTimes(2);
    expect(h.request.mock.calls[1][2]).toEqual({
      user: USER,
      rewardIds: [`1-${FARM_A.toLowerCase()}`, `1-${FARM_B.toLowerCase()}`],
      limit: INDEXER_MAX_QUERY_LIMIT,
      offset: INDEXER_MAX_QUERY_LIMIT
    });
  });
});

describe('fetchRewardFarmEarned', () => {
  const clientWith = (results: unknown[], code?: `0x${string}`) =>
    ({
      multicall: vi.fn().mockResolvedValue(results),
      getCode: vi.fn().mockResolvedValue(code)
    }) as unknown as PublicClient & { multicall: ReturnType<typeof vi.fn> };

  it('keys balances by lowercased farm and forwards the block', async () => {
    const client = clientWith([
      { status: 'success', result: 5n },
      { status: 'success', result: 7n }
    ]);
    const earned = await fetchRewardFarmEarned({
      client,
      userAddress: USER,
      farmAddresses: [FARM_A, FARM_B],
      blockNumber: 123n
    });
    expect(earned).toEqual(
      new Map([
        [FARM_A.toLowerCase(), 5n],
        [FARM_B.toLowerCase(), 7n]
      ])
    );
    expect(client.multicall).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 123n }));
  });

  it('reads a farm without code at the block (not deployed yet) as 0', async () => {
    const client = clientWith([{ status: 'failure', error: new Error('no data') }], undefined);
    const earned = await fetchRewardFarmEarned({ client, userAddress: USER, farmAddresses: [FARM_A] });
    expect(earned.get(FARM_A.toLowerCase())).toBe(0n);
  });

  it('rethrows a failed call on a deployed farm instead of reporting a false zero', async () => {
    const client = clientWith([{ status: 'failure', error: new Error('rpc 500') }], '0x6080');
    await expect(
      fetchRewardFarmEarned({ client, userAddress: USER, farmAddresses: [FARM_A] })
    ).rejects.toThrow('rpc 500');
  });
});
