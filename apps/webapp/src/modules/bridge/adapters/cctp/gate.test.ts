import { describe, expect, it, vi } from 'vitest';
import type { Hex, PublicClient } from 'viem';
import { resolveBridgeRoute } from '../../model/resolveRoute';
import {
  cctpL2Contracts,
  L1_DAI,
  L1_USDC,
  LITE_PSM,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  TOKEN_MINTER_V2,
  USDS_PSM_WRAPPER
} from './contracts';
import { BASE_BURN_AMOUNT, BASE_BURN_ATTESTED } from './cctpFixtures';
import {
  cctpBurnRefusal,
  cctpClaimRefusal,
  cctpConvertRefusal,
  cctpGate,
  cctpL2ConvertRefusal,
  cctpResumeRefusal,
  RESUME_SCAN_MAX_BLOCKS,
  type CctpGateReads
} from './gate';

const HALTED = 2n ** 256n - 1n;
const UNIT = 10n ** 12n;
// Base on 2026-10-20: PSM3 about 999k USDC, LitePSM about 801.8M DAI, a 10M USDC burn cap.
const LIVE: CctpGateReads = {
  sourcePaused: [false, false],
  destinationPaused: [false, false],
  burnLimit: 10n ** 13n,
  psm3Usdc: 999_000n * 10n ** 6n,
  litePsmDai: 801_800_000n * 10n ** 18n,
  live: 1n,
  tin: 0n,
  halted: HALTED
};
const routeFor = (amount: bigint, reads: Partial<CctpGateReads> = {}) =>
  resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount,
    facts: { cctp: cctpGate({ ...LIVE, ...reads }), native: { isOpen: true } }
  });

describe('cctpGate', () => {
  it('opens CCTP with the burn cap and the smaller PSM payout', () => {
    expect(cctpGate(LIVE)).toEqual({
      isOpen: true,
      maxAmount: 10n ** 13n * UNIT,
      liquidity: 999_000n * 10n ** 18n
    });
    expect(cctpGate({ ...LIVE, litePsmDai: 5n })).toMatchObject({ liquidity: 5n });
  });

  // A continued bridge burns USDC already swapped: only the LitePSM's DAI limits its sale on Ethereum.
  it('limits a burn with no swap by the LitePSM payout alone', () => {
    expect(cctpGate({ ...LIVE, psm3Usdc: 0n }, { swap: false })).toMatchObject({
      isOpen: true,
      liquidity: LIVE.litePsmDai
    });
    expect(cctpGate({ ...LIVE, litePsmDai: 5n }, { swap: false })).toMatchObject({ liquidity: 5n });
    expect(cctpGate({ ...LIVE, tin: HALTED }, { swap: false }).isOpen).toBe(false);
  });

  it('reads no USDC liquidity when PSM3 has no USDC to swap out', () => {
    expect(cctpGate({ ...LIVE, psm3Usdc: 0n })).toMatchObject({ isOpen: true, liquidity: 0n });
  });

  it.each([
    ['the L2 minter', { sourcePaused: [true, false] as const }],
    ['the L2 transmitter', { sourcePaused: [false, true] as const }],
    ['the Ethereum minter', { destinationPaused: [true, false] as const }],
    ['the Ethereum transmitter', { destinationPaused: [false, true] as const }],
    ["the wrapper's sell", { tin: HALTED }]
  ])('closes CCTP when %s is paused', (_, reads) => {
    expect(cctpGate({ ...LIVE, ...reads }).isOpen).toBe(false);
  });

  // The wrapper's sell must pay the full USDS, as the USDC supply gate requires.
  it.each([
    ['the wrapper is caged', { live: 0n }],
    ['the wrapper charges a sell fee', { tin: 1n }],
    ['the sell is halted by flag', { tin: 2n, halted: 2n }]
  ])('closes CCTP when %s', (_, reads) => {
    expect(cctpGate({ ...LIVE, ...reads }).isOpen).toBe(false);
  });

  it('keeps CCTP open when only the buy is halted by flag', () => {
    expect(cctpGate({ ...LIVE, halted: 1n }).isOpen).toBe(true);
  });

  it('routes by CCTP within the gate, and by the native withdrawal past it', () => {
    expect(routeFor(1000n * 10n ** 18n)).toMatchObject({ status: 'ok', route: { kind: 'cctp' } });
    expect(routeFor(1_000_000n * 10n ** 18n)).toMatchObject({
      status: 'ok',
      route: { kind: 'native', fallbackReason: 'no-liquidity' }
    });
    expect(routeFor(1n, { burnLimit: 0n })).toMatchObject({
      route: { kind: 'native', fallbackReason: 'over-limit' }
    });
    expect(routeFor(1n, { tin: HALTED })).toMatchObject({
      route: { kind: 'native', fallbackReason: 'closed' }
    });
  });
});

describe('cctpBurnRefusal', () => {
  const { psm3, usdc } = cctpL2Contracts('base');
  type Read = { address: string; functionName: string; args?: readonly unknown[] };
  const client = (answer: (read: Read) => unknown) =>
    ({ readContract: vi.fn(async (read: Read) => answer(read)) }) as unknown as PublicClient;
  // PSM3 swaps out the USDC its pocket holds; `usdcOf` sets a holder's USDC (PSM3 is its own pocket by default).
  const source = (
    change: Partial<Record<string, unknown>> = {},
    usdcOf: Record<string, bigint> = { [psm3]: LIVE.psm3Usdc }
  ) =>
    client(({ address, functionName, args }) => {
      if (address === usdc && functionName === 'balanceOf') return usdcOf[args?.[0] as string] ?? 0n;
      const values: Record<string, unknown> = {
        [`${TOKEN_MINTER_V2}.paused`]: false,
        [`${MESSAGE_TRANSMITTER_V2}.paused`]: false,
        [`${TOKEN_MINTER_V2}.burnLimitsPerMessage`]: LIVE.burnLimit,
        [`${psm3}.pocket`]: psm3,
        ...change
      };
      return values[`${address}.${functionName}`];
    });
  const destination = (change: Partial<Record<string, unknown>> = {}) =>
    client(({ address, functionName, args }) => {
      if (functionName === 'balanceOf') {
        expect(args).toEqual([LITE_PSM]);
        return change.dai ?? LIVE.litePsmDai;
      }
      const values: Record<string, unknown> = {
        [`${TOKEN_MINTER_V2}.paused`]: false,
        [`${MESSAGE_TRANSMITTER_V2}.paused`]: false,
        [`${USDS_PSM_WRAPPER}.live`]: 1n,
        [`${USDS_PSM_WRAPPER}.tin`]: 0n,
        [`${USDS_PSM_WRAPPER}.HALTED`]: HALTED,
        ...change
      };
      return values[`${address}.${functionName}`];
    });
  const refusal = (amount: bigint, sourceClient = source(), destinationClient = destination()) =>
    cctpBurnRefusal({ network: 'base', amount, source: sourceClient, destination: destinationClient });

  it('lets a burn within the gate through, reading both chains afresh', async () => {
    const sourceClient = source();
    const destinationClient = destination();
    await expect(refusal(1000n * UNIT, sourceClient, destinationClient)).resolves.toBeUndefined();
    expect(sourceClient.readContract).toHaveBeenCalledTimes(5);
    expect(destinationClient.readContract).toHaveBeenCalledTimes(6);
  });

  it.each([
    ['the L2 minter is paused', source({ [`${TOKEN_MINTER_V2}.paused`]: true }), destination()],
    [
      'the Ethereum transmitter is paused',
      source(),
      destination({ [`${MESSAGE_TRANSMITTER_V2}.paused`]: true })
    ],
    ['the wrapper sell is halted', source(), destination({ [`${USDS_PSM_WRAPPER}.tin`]: HALTED })],
    ['the wrapper is caged', source(), destination({ [`${USDS_PSM_WRAPPER}.live`]: 0n })]
  ])('refuses a burn when %s', async (_, sourceClient, destinationClient) => {
    await expect(refusal(UNIT, sourceClient, destinationClient)).resolves.toHaveProperty(
      'message',
      expect.stringContaining('CCTP is paused.')
    );
  });

  it('refuses a burn over the cap or the liquidity of either PSM', async () => {
    await expect(refusal(LIVE.psm3Usdc * UNIT + 1n)).resolves.toHaveProperty(
      'message',
      expect.stringContaining('not enough liquidity')
    );
    await expect(refusal(2n * UNIT, source(), destination({ dai: UNIT }))).resolves.toHaveProperty(
      'message',
      expect.stringContaining('not enough liquidity')
    );
    await expect(
      refusal(2n * UNIT, source({ [`${psm3}.pocket`]: LITE_PSM }), destination())
    ).resolves.toHaveProperty('message', expect.stringContaining('not enough liquidity'));
    await expect(
      refusal(2n * UNIT, source({ [`${TOKEN_MINTER_V2}.burnLimitsPerMessage`]: 1n }), destination())
    ).resolves.toHaveProperty('message', expect.stringContaining('over what one CCTP transfer'));
  });

  // A continued bridge swaps nothing, so PSM3's USDC can't hold it back; the LitePSM's DAI still can.
  it("ignores PSM3's USDC, but not the LitePSM's DAI, when the burn swaps nothing", async () => {
    const amount = LIVE.psm3Usdc * UNIT + UNIT;
    const noSwap = (destinationClient = destination()) =>
      cctpBurnRefusal({
        network: 'base',
        amount,
        source: source(),
        destination: destinationClient,
        swap: false
      });
    await expect(noSwap()).resolves.toBeUndefined();
    await expect(
      cctpBurnRefusal({
        network: 'base',
        amount,
        source: source({ [`${psm3}.pocket`]: LITE_PSM }),
        destination: destination(),
        swap: false
      })
    ).resolves.toBeUndefined();
    await expect(noSwap(destination({ dai: amount - 1n }))).resolves.toHaveProperty(
      'message',
      expect.stringContaining('not enough liquidity')
    );
  });

  it('counts the USDC of the pocket PSM3 swaps from, wherever it is', async () => {
    const pocket = '0x000000000000000000000000000000000000beef';
    const elsewhere = source({ [`${psm3}.pocket`]: pocket }, { [psm3]: 0n, [pocket]: LIVE.psm3Usdc });
    await expect(refusal(1000n * UNIT, elsewhere)).resolves.toBeUndefined();
    await expect(
      refusal(
        LIVE.psm3Usdc * UNIT + 1n,
        source({ [`${psm3}.pocket`]: pocket }, { [psm3]: 0n, [pocket]: LIVE.psm3Usdc })
      )
    ).resolves.toHaveProperty('message', expect.stringContaining('not enough liquidity'));
    // USDC left on PSM3 itself can't be swapped out once another pocket holds the backing.
    await expect(
      refusal(2n * UNIT, source({ [`${psm3}.pocket`]: pocket }, { [psm3]: LIVE.psm3Usdc, [pocket]: 1n }))
    ).resolves.toHaveProperty('message', expect.stringContaining('not enough liquidity'));
  });

  it('rejects when a read fails, so the send is refused', async () => {
    const failing = client(() => {
      throw new Error('rpc down');
    });
    await expect(refusal(UNIT, failing)).rejects.toThrow('rpc down');
  });
});

describe('cctpClaimRefusal (golden: the attested Base burn)', () => {
  type Read = { address: string; functionName: string; args?: readonly unknown[] };
  const ethereum = (change: Partial<Record<string, unknown>> = {}) =>
    ({
      getBlockNumber: vi.fn(async () => (change.block as bigint | undefined) ?? 24_000_000n),
      readContract: vi.fn(async ({ address, functionName, args }: Read) => {
        if (functionName === 'usedNonces') {
          expect(args).toEqual([BASE_BURN_ATTESTED.nonce]);
          return change.used ?? 0n;
        }
        if (functionName === 'balanceOf') return change.dai ?? LIVE.litePsmDai;
        const values: Record<string, unknown> = {
          [`${TOKEN_MINTER_V2}.paused`]: false,
          [`${MESSAGE_TRANSMITTER_V2}.paused`]: false,
          [`${USDS_PSM_WRAPPER}.live`]: 1n,
          [`${USDS_PSM_WRAPPER}.tin`]: 0n,
          [`${USDS_PSM_WRAPPER}.HALTED`]: HALTED,
          ...change
        };
        return values[`${address}.${functionName}`];
      })
    }) as unknown as PublicClient;
  const refusal = (client = ethereum(), message: Hex = BASE_BURN_ATTESTED.message) =>
    cctpClaimRefusal({ message, client });
  const expiringAt = (block: bigint) =>
    `${BASE_BURN_ATTESTED.message.slice(0, 2 + (148 + 196) * 2)}${block.toString(16).padStart(64, '0')}${BASE_BURN_ATTESTED.message.slice(2 + (148 + 228) * 2)}` as Hex;

  it('lets an unclaimed message through', async () => {
    await expect(refusal()).resolves.toBeUndefined();
  });

  // The transmitter reverts at or past the expiration block, and the receive mines after the latest one.
  it('refuses a message that expires by the next block, and lets one before it through', async () => {
    await expect(refusal(ethereum({ block: 99n }), expiringAt(100n))).resolves.toHaveProperty(
      'message',
      expect.stringContaining('expired')
    );
    await expect(refusal(ethereum({ block: 98n }), expiringAt(100n))).resolves.toBeUndefined();
  });

  it.each([
    ['already received', { used: 1n }, 'already claimed'],
    ['received while Ethereum is paused', { [`${MESSAGE_TRANSMITTER_V2}.paused`]: true }, 'CCTP is paused'],
    ['sold while the wrapper is halted', { [`${USDS_PSM_WRAPPER}.tin`]: HALTED }, 'CCTP is paused'],
    ['sold while the wrapper is caged', { [`${USDS_PSM_WRAPPER}.live`]: 0n }, 'CCTP is paused'],
    ['sold with a fee', { [`${USDS_PSM_WRAPPER}.tin`]: 1n }, 'CCTP is paused'],
    ['sold with too little DAI', { dai: BASE_BURN_AMOUNT * UNIT - 1n }, 'not enough liquidity']
  ])('refuses a message that would be %s', async (_, change, reason) => {
    await expect(refusal(ethereum(change))).resolves.toHaveProperty(
      'message',
      expect.stringContaining(reason)
    );
  });
});

describe('cctpResumeRefusal', () => {
  const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
  const RECIPIENT = '0x00000000000000000000000000000000000b0b01';
  const USDC_AMOUNT = 250n * 10n ** 6n;
  const SWAP = ('0x' + 'ab'.repeat(32)) as Hex;
  const { psm3, usdc } = cctpL2Contracts('base');
  // The DepositForBurn of the bridge the swap was for.
  const burnOf = (change: Record<string, unknown> = {}) => ({
    args: {
      amount: USDC_AMOUNT,
      mintRecipient: `0x${RECIPIENT.slice(2).padStart(64, '0')}`,
      destinationDomain: 0,
      ...change
    }
  });
  const client = ({
    receipt = { status: 'success', from: ACCOUNT, to: psm3, blockNumber: 100n } as
      Record<string, unknown> | Error,
    burns = [] as unknown[] | Error,
    outflows = [] as unknown[] | Error
  } = {}) =>
    ({
      getTransactionReceipt: vi.fn(async () => {
        if (receipt instanceof Error) throw receipt;
        return receipt;
      }),
      getBlockNumber: vi.fn(async () => 200n),
      getContractEvents: vi.fn(async ({ eventName }: { eventName: string }) => {
        const events = eventName === 'DepositForBurn' ? burns : eventName === 'Transfer' ? outflows : [];
        if (events instanceof Error) throw events;
        return events;
      })
    }) as unknown as PublicClient;
  const refusal = (c: PublicClient) =>
    cctpResumeRefusal({
      network: 'base',
      swapTxHash: SWAP,
      account: ACCOUNT,
      usdcAmount: USDC_AMOUNT,
      recipient: RECIPIENT,
      client: c
    });

  it('continues a mined swap of the account on PSM3 with no burn and no USDC leaving the wallet since', async () => {
    const c = client();
    await expect(refusal(c)).resolves.toBeUndefined();
    expect(c.getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TOKEN_MESSENGER_V2,
        eventName: 'DepositForBurn',
        args: { burnToken: usdc, depositor: ACCOUNT },
        fromBlock: 100n
      })
    );
    expect(c.getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        address: usdc,
        eventName: 'Transfer',
        args: { from: ACCOUNT },
        fromBlock: 100n
      })
    );
  });

  it('refuses a swap with no receipt yet, or one that reverted', async () => {
    await expect(refusal(client({ receipt: new Error('not found') }))).resolves.toHaveProperty(
      'message',
      expect.stringMatching(/not confirmed/)
    );
    await expect(
      refusal(client({ receipt: { status: 'reverted', from: ACCOUNT, to: psm3, blockNumber: 1n } }))
    ).resolves.toHaveProperty('message', expect.stringMatching(/failed/));
  });

  it('refuses a tx of another account or to another contract', async () => {
    const other = '0x1111111111111111111111111111111111111111';
    await expect(
      refusal(client({ receipt: { status: 'success', from: other, to: psm3, blockNumber: 1n } }))
    ).resolves.toHaveProperty('message', expect.stringMatching(/not a bridge/));
    await expect(
      refusal(client({ receipt: { status: 'success', from: ACCOUNT, to: other, blockNumber: 1n } }))
    ).resolves.toHaveProperty('message', expect.stringMatching(/not a bridge/));
    await expect(
      refusal(client({ receipt: { status: 'success', from: ACCOUNT, to: null, blockNumber: 1n } }))
    ).resolves.toHaveProperty('message', expect.stringMatching(/not a bridge/));
  });

  it("refuses as already sent once this bridge's burn followed the swap", async () => {
    // The burn moves the USDC out of the wallet too.
    await expect(refusal(client({ burns: [burnOf()], outflows: [{}] }))).resolves.toHaveProperty(
      'message',
      expect.stringMatching(/already sent/)
    );
  });

  it('refuses once USDC left the wallet after the swap, so USDC it held before is never burned', async () => {
    await expect(refusal(client({ outflows: [{}] }))).resolves.toHaveProperty(
      'message',
      expect.stringMatching(/USDC left this wallet/)
    );
  });

  it.each<[string, Record<string, unknown>]>([
    ['another amount', { amount: USDC_AMOUNT - 1n }],
    ['another recipient', { mintRecipient: `0x${ACCOUNT.slice(2).padStart(64, '0')}` }],
    ['another destination', { destinationDomain: 6 }]
  ])('refuses a later burn of %s as USDC that left the wallet, not as this bridge', async (_, change) => {
    await expect(refusal(client({ burns: [burnOf(change)], outflows: [{}] }))).resolves.toHaveProperty(
      'message',
      expect.stringMatching(/USDC left this wallet/)
    );
  });

  it('matches the recipient in any case', async () => {
    const mixed = `0x${RECIPIENT.slice(2).toUpperCase().padStart(64, '0')}`;
    await expect(
      refusal(client({ burns: [burnOf({ mintRecipient: mixed })], outflows: [{}] }))
    ).resolves.toHaveProperty('message', expect.stringMatching(/already sent/));
  });

  it('fails closed when the burns or the transfers cannot be read', async () => {
    await expect(refusal(client({ burns: new Error('range too large') }))).rejects.toThrow('range too large');
    await expect(refusal(client({ outflows: new Error('range too large') }))).rejects.toThrow(
      'range too large'
    );
  });
});

describe('cctpConvertRefusal', () => {
  type Read = { address: string; functionName: string; args?: readonly unknown[] };
  const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  const AMOUNT = 250n * 10n ** 6n;
  const ethereum = (change: Partial<Record<string, unknown>> = {}) =>
    ({
      readContract: vi.fn(async ({ address, functionName, args }: Read) => {
        const values: Record<string, unknown> = {
          [`${L1_DAI}.balanceOf.${LITE_PSM}`]: LIVE.litePsmDai,
          [`${L1_USDC}.balanceOf.${ACCOUNT}`]: AMOUNT,
          [`${USDS_PSM_WRAPPER}.live`]: 1n,
          [`${USDS_PSM_WRAPPER}.tin`]: 0n,
          [`${USDS_PSM_WRAPPER}.HALTED`]: HALTED,
          ...change
        };
        const key = [address, functionName, ...(args ?? [])].join('.');
        if (!(key in values)) throw new Error(`unexpected read ${key}`);
        return values[key];
      })
    }) as unknown as PublicClient;
  const refusal = (client = ethereum(), amount = AMOUNT) =>
    cctpConvertRefusal({ amount, account: ACCOUNT, client });

  it('lets a conversion of USDC the account holds through', async () => {
    await expect(refusal()).resolves.toBeUndefined();
  });

  it.each([
    ['while the wrapper is halted', { [`${USDS_PSM_WRAPPER}.tin`]: HALTED }, "can't convert"],
    ['while the wrapper is caged', { [`${USDS_PSM_WRAPPER}.live`]: 0n }, "can't convert"],
    ['with a fee', { [`${USDS_PSM_WRAPPER}.tin`]: 1n }, "can't convert"],
    [
      'with too little DAI',
      { [`${L1_DAI}.balanceOf.${LITE_PSM}`]: AMOUNT * UNIT - 1n },
      'not enough liquidity'
    ],
    ['of more USDC than the account holds', { [`${L1_USDC}.balanceOf.${ACCOUNT}`]: AMOUNT - 1n }, 'less USDC']
  ])('refuses a conversion %s', async (_, change, reason) => {
    await expect(refusal(ethereum(change))).resolves.toHaveProperty(
      'message',
      expect.stringContaining(reason)
    );
  });

  it('refuses nothing to convert', async () => {
    await expect(refusal(ethereum(), 0n)).resolves.toHaveProperty(
      'message',
      expect.stringContaining('Nothing')
    );
  });

  it('fails closed when a read fails', async () => {
    const failing = {
      readContract: vi.fn(async () => {
        throw new Error('rpc down');
      })
    } as unknown as PublicClient;
    await expect(refusal(failing)).rejects.toThrow('rpc down');
  });
});

describe('cctpL2ConvertRefusal', () => {
  type Read = { address: string; functionName: string; args?: readonly unknown[] };
  const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  const AMOUNT = 250n * 10n ** 6n;
  const { psm3, usds, usdc } = cctpL2Contracts('base');
  const base = (change: Partial<Record<string, unknown>> = {}) =>
    ({
      readContract: vi.fn(async ({ address, functionName, args }: Read) => {
        const values: Record<string, unknown> = {
          [`${psm3}.previewSwapExactIn.${usdc}.${usds}.${AMOUNT}`]: AMOUNT * UNIT,
          [`${usds}.balanceOf.${psm3}`]: AMOUNT * UNIT,
          [`${usdc}.balanceOf.${ACCOUNT}`]: AMOUNT,
          ...change
        };
        const key = [address, functionName, ...(args ?? [])].join('.');
        if (!(key in values)) throw new Error(`unexpected read ${key}`);
        return values[key];
      })
    }) as unknown as PublicClient;
  const refusal = (client = base(), amount = AMOUNT) =>
    cctpL2ConvertRefusal({ network: 'base', amount, account: ACCOUNT, client });

  it('lets a 1:1 conversion of USDC the account holds through', async () => {
    await expect(refusal()).resolves.toBeUndefined();
  });

  it.each([
    [
      'at less than 1:1',
      { [`${psm3}.previewSwapExactIn.${usdc}.${usds}.${AMOUNT}`]: AMOUNT * UNIT - 1n },
      "can't convert"
    ],
    [
      'with too little USDS on PSM3',
      { [`${usds}.balanceOf.${psm3}`]: AMOUNT * UNIT - 1n },
      'not enough liquidity'
    ],
    ['of more USDC than the account holds', { [`${usdc}.balanceOf.${ACCOUNT}`]: AMOUNT - 1n }, 'less USDC']
  ])('refuses a conversion %s', async (_, change, reason) => {
    await expect(refusal(base(change))).resolves.toHaveProperty('message', expect.stringContaining(reason));
  });

  it('refuses nothing to convert', async () => {
    await expect(refusal(base(), 0n)).resolves.toHaveProperty('message', expect.stringContaining('Nothing'));
  });

  it('fails closed when a read fails', async () => {
    const failing = {
      readContract: vi.fn(async () => {
        throw new Error('rpc down');
      })
    } as unknown as PublicClient;
    await expect(refusal(failing)).rejects.toThrow('rpc down');
  });
});

describe('cctpResumeRefusal on a provider that caps log queries at 10k blocks', () => {
  const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
  const RECIPIENT = '0x00000000000000000000000000000000000b0b01';
  const USDC_AMOUNT = 250n * 10n ** 6n;
  const { psm3 } = cctpL2Contracts('base');
  const LATEST = 200_000n;
  // About two days of Base blocks before the latest one.
  const SWAP_BLOCK = 100_000n;
  const burn = {
    args: {
      amount: USDC_AMOUNT,
      mintRecipient: `0x${RECIPIENT.slice(2).padStart(64, '0')}`,
      destinationDomain: 0
    }
  };
  const capped = ({
    burnAt,
    outflowAt,
    failAt
  }: { burnAt?: bigint; outflowAt?: bigint; failAt?: bigint } = {}) =>
    ({
      getTransactionReceipt: vi.fn(async () => ({
        status: 'success',
        from: ACCOUNT,
        to: psm3,
        blockNumber: SWAP_BLOCK
      })),
      getBlockNumber: vi.fn(async () => LATEST),
      getContractEvents: vi.fn(
        async ({
          eventName,
          fromBlock,
          toBlock
        }: {
          eventName: string;
          fromBlock: bigint;
          toBlock?: bigint;
        }) => {
          if (toBlock === undefined || toBlock - fromBlock >= 10_000n)
            throw new Error('query exceeds max block range 10000');
          if (toBlock > LATEST) throw new Error('block range extends beyond current head block');
          const within = (at?: bigint) => at !== undefined && fromBlock <= at && at <= toBlock;
          if (within(failAt)) throw new Error('upstream timeout');
          if (eventName === 'DepositForBurn') return within(burnAt) ? [burn] : [];
          return within(burnAt) || within(outflowAt) ? [{}] : [];
        }
      )
    }) as unknown as PublicClient;
  const refusal = (client: PublicClient) =>
    cctpResumeRefusal({
      network: 'base',
      swapTxHash: ('0x' + 'ab'.repeat(32)) as Hex,
      account: ACCOUNT,
      usdcAmount: USDC_AMOUNT,
      recipient: RECIPIENT,
      client
    });

  it('continues a swap with no burn and no outflow, however old', async () => {
    await expect(refusal(capped())).resolves.toBeUndefined();
  });

  it('still finds the burn or the outflow far after the swap', async () => {
    await expect(refusal(capped({ burnAt: 195_000n }))).resolves.toHaveProperty(
      'message',
      expect.stringMatching(/already sent/)
    );
    await expect(refusal(capped({ outflowAt: LATEST }))).resolves.toHaveProperty(
      'message',
      expect.stringMatching(/USDC left this wallet/)
    );
  });

  it('fails closed when any part of the range cannot be read', async () => {
    await expect(refusal(capped({ failAt: 150_000n }))).rejects.toThrow('upstream timeout');
  });

  it('never continues on a node that is behind the swap, as nothing after it was read', async () => {
    const client = capped({ burnAt: SWAP_BLOCK });
    vi.mocked(client.getBlockNumber).mockResolvedValue(SWAP_BLOCK - 1n);
    await expect(refusal(client)).resolves.toBeInstanceOf(Error);
  });
});

describe('cctpResumeRefusal against a head that moves or a record that is old', () => {
  const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
  const RECIPIENT = '0x00000000000000000000000000000000000b0b01';
  const USDC_AMOUNT = 250n * 10n ** 6n;
  const { psm3 } = cctpL2Contracts('base');
  const SWAP_BLOCK = 100_000n;
  const burn = {
    args: {
      amount: USDC_AMOUNT,
      mintRecipient: `0x${RECIPIENT.slice(2).padStart(64, '0')}`,
      destinationDomain: 0
    }
  };
  // Like viem, a head read without cacheTime 0 may return the head of a few seconds ago.
  const chain = ({ heads, stale, burnAt }: { heads: bigint[]; stale?: bigint; burnAt?: bigint }) => {
    let read = 0;
    return {
      getTransactionReceipt: vi.fn(async () => ({
        status: 'success',
        from: ACCOUNT,
        to: psm3,
        blockNumber: SWAP_BLOCK
      })),
      getBlockNumber: vi.fn(async ({ cacheTime }: { cacheTime?: number } = {}) =>
        cacheTime !== 0 && stale !== undefined ? stale : heads[Math.min(read++, heads.length - 1)]
      ),
      getContractEvents: vi.fn(
        async ({ fromBlock, toBlock }: { eventName: string; fromBlock: bigint; toBlock: bigint }) =>
          burnAt !== undefined && fromBlock <= burnAt && burnAt <= toBlock ? [burn] : []
      )
    } as unknown as PublicClient;
  };
  const refusal = (client: PublicClient) =>
    cctpResumeRefusal({
      network: 'base',
      swapTxHash: ('0x' + 'ab'.repeat(32)) as Hex,
      account: ACCOUNT,
      usdcAmount: USDC_AMOUNT,
      recipient: RECIPIENT,
      client
    });

  it('sees a burn mined after a cached head', async () => {
    const client = chain({ heads: [SWAP_BLOCK + 20n], stale: SWAP_BLOCK + 10n, burnAt: SWAP_BLOCK + 15n });
    await expect(refusal(client)).resolves.toHaveProperty('message', expect.stringMatching(/already sent/));
  });

  it('sees a burn mined while the range was being scanned', async () => {
    const client = chain({ heads: [SWAP_BLOCK + 20n, SWAP_BLOCK + 30n], burnAt: SWAP_BLOCK + 25n });
    await expect(refusal(client)).resolves.toHaveProperty('message', expect.stringMatching(/already sent/));
  });

  it('refuses a swap too old to scan, with a bounded number of reads', async () => {
    const client = chain({ heads: [SWAP_BLOCK + RESUME_SCAN_MAX_BLOCKS + 1n] });
    await expect(refusal(client)).resolves.toHaveProperty('message', expect.stringMatching(/too old/));
    expect(vi.mocked(client.getContractEvents).mock.calls.length).toBeLessThanOrEqual(
      Number((2n * RESUME_SCAN_MAX_BLOCKS) / 10_000n) + 2
    );
  });

  it('still continues a swap just within the scan limit', async () => {
    const client = chain({ heads: [SWAP_BLOCK + RESUME_SCAN_MAX_BLOCKS - 1n] });
    await expect(refusal(client)).resolves.toBeUndefined();
  });
});
