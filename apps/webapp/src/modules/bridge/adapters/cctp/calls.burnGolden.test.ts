import { describe, expect, it } from 'vitest';
import { encodeFunctionData, getAddress, type Call, type Hex } from 'viem';
import { cctpBurnCalls } from './calls';
import { BASE_BURN_AMOUNT, BASE_BURN_MINT_RECIPIENT, BASE_BURN_TX } from './cctp.fixtures';
import { CCTP_L2_NETWORKS } from './contracts';
import {
  GOLDEN_L2,
  GOLDEN_RECIPIENT,
  GOLDEN_SENDER,
  GOLDEN_USDS,
  goldenBurnLegs,
  type GoldenLeg
} from './burnGolden.fixtures';

// On every L2 the swap's USDC goes to the sender and the mint to the
// recipient, at that chain's own contracts.

type ContractCall = Call & { to: Hex; abi: never; functionName: string; args: readonly unknown[] };
const legs = (calls: Call[]): GoldenLeg[] =>
  (calls as ContractCall[]).map(({ to, abi, functionName, args }) => ({
    to: to.toLowerCase(),
    data: encodeFunctionData({ abi, functionName, args } as Parameters<typeof encodeFunctionData>[0])
  }));

const burnCalls = (overrides: Partial<Parameters<typeof cctpBurnCalls>[0]>) =>
  cctpBurnCalls({
    network: 'base',
    amount: GOLDEN_USDS,
    account: GOLDEN_SENDER,
    mintRecipient: GOLDEN_SENDER,
    usdsAllowance: 0n,
    usdcAllowance: 0n,
    ...overrides
  });

describe('the hand-laid CCTP burn', () => {
  it('is the real Base burn 0x5bb3d46a…6b6a', () => {
    const account = getAddress(BASE_BURN_TX.from);
    const golden = goldenBurnLegs('base', {
      sender: account,
      recipient: getAddress(BASE_BURN_MINT_RECIPIENT),
      usdc: BASE_BURN_AMOUNT
    });
    expect(golden.at(-1)!.data).toBe(BASE_BURN_TX.input);
  });

  it('exists for every L2 that bridges through CCTP', () => {
    expect(Object.keys(GOLDEN_L2).sort()).toEqual([...CCTP_L2_NETWORKS].sort());
  });
});

describe.each(CCTP_L2_NETWORKS)('a CCTP burn from %s', network => {
  it('mints to another recipient, and swaps to the sender', () => {
    expect(legs(burnCalls({ network, mintRecipient: GOLDEN_RECIPIENT }))).toEqual(
      goldenBurnLegs(network, { sender: GOLDEN_SENDER, recipient: GOLDEN_RECIPIENT })
    );
  });

  it('mints to the sender when the sender is the recipient', () => {
    expect(legs(burnCalls({ network }))).toEqual(
      goldenBurnLegs(network, { sender: GOLDEN_SENDER, recipient: GOLDEN_SENDER })
    );
  });

  it('burns a continued bridge to its recipient, with no swap', () => {
    expect(legs(burnCalls({ network, mintRecipient: GOLDEN_RECIPIENT, swap: false }))).toEqual(
      goldenBurnLegs(network, { sender: GOLDEN_SENDER, recipient: GOLDEN_RECIPIENT }).slice(2)
    );
  });
});
