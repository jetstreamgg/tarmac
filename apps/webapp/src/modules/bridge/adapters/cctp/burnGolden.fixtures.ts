import type { Address, Hex } from 'viem';
import type { CctpL2NetworkId } from './contracts';

// The legs of a CCTP burn on each L2, laid out by hand from literal addresses:
// independent of the generated constants and of the ABIs the app encodes with.

/** Each PSM3's own `usdc()` and `usds()` return these tokens on its chain. */
export const GOLDEN_L2: Record<CctpL2NetworkId, { psm3: Address; usds: Address; usdc: Address }> = {
  base: {
    psm3: '0x1601843c5E9bC251A3272907010AFa41Fa18347E',
    usds: '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
  },
  optimism: {
    psm3: '0xe0F9978b907853F354d79188A3dEfbD41978af62',
    usds: '0x4F13a96EC5C4Cf34e442b46Bbd98a0791F20edC3',
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
  },
  unichain: {
    psm3: '0x7b42Ed932f26509465F7cE3FAF76FfCe1275312f',
    usds: '0x7E10036Acc4B56d4dFCa3b77810356CE52313F9C',
    usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6'
  },
  arbitrum: {
    psm3: '0x2B05F8e1cACC6974fD79A673a341Fe1f58d27266',
    usds: '0x6491c05A82219b8D1479057361ff1654749b876b',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
  }
};

export const GOLDEN_TOKEN_MESSENGER: Address = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
export const GOLDEN_SENDER: Address = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
export const GOLDEN_RECIPIENT: Address = '0x1111111111111111111111111111111111111111';

/** 1234.567891 USDC. */
export const GOLDEN_USDC = 1_234_567_891n;
/** The same in USDS, plus dust under one USDC unit that must stay in the wallet. */
export const GOLDEN_USDS = GOLDEN_USDC * 10n ** 12n + 5n;

const APPROVE = '0x095ea7b3';
const SWAP_EXACT_IN = '0x1a019e37';
const DEPOSIT_FOR_BURN = '0x8e0250ee';
const ETHEREUM_DOMAIN = 0n;
const STANDARD_FINALITY = 2000n;

const word = (value: bigint | string) =>
  (typeof value === 'bigint' ? value.toString(16) : value.slice(2).toLowerCase()).padStart(64, '0');

export type GoldenLeg = { to: string; data: Hex };

/** approve USDS, swap to the sender, approve USDC, burn to the recipient. */
export const goldenBurnLegs = (
  network: CctpL2NetworkId,
  { sender, recipient, usdc: burn = GOLDEN_USDC }: { sender: Address; recipient: Address; usdc?: bigint }
): GoldenLeg[] => {
  const { psm3, usds, usdc } = GOLDEN_L2[network];
  const swapIn = burn * 10n ** 12n;
  const legs: [Address, string][] = [
    [usds, APPROVE + word(psm3) + word(swapIn)],
    [psm3, SWAP_EXACT_IN + word(usds) + word(usdc) + word(swapIn) + word(burn) + word(sender) + word(0n)],
    [usdc, APPROVE + word(GOLDEN_TOKEN_MESSENGER) + word(burn)],
    [
      GOLDEN_TOKEN_MESSENGER,
      DEPOSIT_FOR_BURN +
        word(burn) +
        word(ETHEREUM_DOMAIN) +
        word(recipient) +
        word(usdc) +
        word(0n) +
        word(0n) +
        word(STANDARD_FINALITY)
    ]
  ];
  return legs.map(([to, data]) => ({ to: to.toLowerCase(), data: data as Hex }));
};
