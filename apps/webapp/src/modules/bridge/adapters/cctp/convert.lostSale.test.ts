import { parseUnits, type Hex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import {
  applyProgress,
  createPendingBridge,
  recordAction,
  recordNextLeg
} from '../../model/pendingTransitions';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import { L1_USDC, LITE_PSM, USDS_PSM_WRAPPER } from './contracts';
import { LOST_SALE_BLOCKS, findLostSale } from './convert';

const RECIPIENT: Hex = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
const USDC = (amount: string) => parseUnits(amount, 6);

const claimed = () => {
  const resolved = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const ready = applyProgress(
    createPendingBridge({
      account: RECIPIENT,
      amount: parseUnits('100', 18),
      from: 'base',
      to: 'ethereum',
      route: resolved.route,
      txHash: '0xburn',
      now: 1
    }),
    { kind: 'ready', nextAction: 'claim' },
    1
  );
  return recordNextLeg(
    recordAction(ready, { action: 'claim', txHash: '0xclaim', at: 1 }),
    'claim',
    '0xsaleleg',
    1
  );
};

const transfer = (transactionHash: string, value: bigint) => ({ transactionHash, args: { value } });
const chain = (logs: unknown[], head = 10_000n) => ({
  getBlockNumber: vi.fn(async () => head),
  getLogs: vi.fn(async () => logs)
});

describe('findLostSale', () => {
  it("reads the recipient's USDC sent to the wrapper or the LitePSM in Ethereum's last hour only", async () => {
    const l1 = chain([]);
    await expect(
      findLostSale({ l1: l1 as never, bridge: claimed(), recipient: RECIPIENT })
    ).resolves.toBeNull();
    expect(l1.getLogs).toHaveBeenCalledTimes(1);
    expect(l1.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: L1_USDC,
        args: { from: RECIPIENT, to: [USDS_PSM_WRAPPER, LITE_PSM] },
        fromBlock: 10_000n - LOST_SALE_BLOCKS,
        toBlock: 10_000n
      })
    );
  });

  it('reads from the first block on a chain shorter than an hour', async () => {
    const l1 = chain([], 100n);
    await findLostSale({ l1: l1 as never, bridge: claimed(), recipient: RECIPIENT });
    expect(l1.getLogs).toHaveBeenCalledWith(expect.objectContaining({ fromBlock: 0n, toBlock: 100n }));
  });

  it('finds the latest sale of up to what the claim minted', async () => {
    const l1 = chain([transfer('0xa', USDC('40')), transfer('0xb', USDC('100'))]);
    await expect(findLostSale({ l1: l1 as never, bridge: claimed(), recipient: RECIPIENT })).resolves.toBe(
      '0xb'
    );
  });

  it('ignores a transfer the card already knows, one larger than the claim minted, and an empty one', async () => {
    const l1 = chain([
      transfer('0xCLAIM', USDC('100')),
      transfer('0xsaleleg', USDC('100')),
      transfer('0xbig', USDC('100') + 1n),
      transfer('0xzero', 0n)
    ]);
    await expect(
      findLostSale({ l1: l1 as never, bridge: claimed(), recipient: RECIPIENT })
    ).resolves.toBeNull();
  });

  it("matches a convert's exact amount, and skips a sale another card knows", async () => {
    const other = {
      ...claimed(),
      id: '0xother',
      actions: [{ action: 'convert' as const, txHash: '0xOTHERS', at: 1 }]
    };
    const l1 = chain([
      transfer('0xothers', USDC('25')),
      transfer('0xexact', USDC('25')),
      transfer('0xless', USDC('24'))
    ]);
    await expect(
      findLostSale({
        l1: l1 as never,
        bridge: claimed(),
        recipient: RECIPIENT,
        amount: USDC('25'),
        cards: [other]
      })
    ).resolves.toBe('0xexact');
  });

  it("skips a sale in another card's broken-up bundle", async () => {
    const other = {
      ...claimed(),
      id: '0xother',
      actions: [{ action: 'convert' as const, txHash: '0xcalls', bundleTxHashes: ['0xOTHERSALE'], at: 1 }]
    };
    const l1 = chain([transfer('0xothersale', USDC('25'))]);
    await expect(
      findLostSale({
        l1: l1 as never,
        bridge: claimed(),
        recipient: RECIPIENT,
        amount: USDC('25'),
        cards: [other]
      })
    ).resolves.toBeNull();
  });

  it('reads only the blocks since the prompt opened, plus slack', async () => {
    const l1 = chain([]);
    await findLostSale({
      l1: l1 as never,
      bridge: claimed(),
      recipient: RECIPIENT,
      since: Date.now() - 60_000 + 6_000
    });
    expect(l1.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 10_000n - 30n, toBlock: 10_000n })
    );
  });

  it('rejects when a read fails', async () => {
    const l1 = {
      getBlockNumber: vi.fn(async () => 1n),
      getLogs: vi.fn(async () => Promise.reject(new Error('rpc down')))
    };
    await expect(findLostSale({ l1: l1 as never, bridge: claimed(), recipient: RECIPIENT })).rejects.toThrow(
      'rpc down'
    );
  });
});
