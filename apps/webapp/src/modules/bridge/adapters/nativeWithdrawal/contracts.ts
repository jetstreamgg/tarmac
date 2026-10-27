import type { Address } from 'viem';
import type { OpStackNetworkId } from '../nativeDeposit/contracts';

/** The L1 side of Sky's OP Stack withdrawals: the messenger relays the message, the escrow pays it out. */
export const OP_STACK_WITHDRAWAL: Record<OpStackNetworkId, { l1Escrow: Address; l1Messenger: Address }> = {
  base: {
    l1Escrow: '0x7F311a4D48377030bD810395f4CCfC03bdbe9Ef3',
    l1Messenger: '0x866E82a600A1414e583f7F13623F1aC5d58b0Afa'
  },
  optimism: {
    l1Escrow: '0x467194771dAe2967Aef3ECbEDD3Bf9a310C76C65',
    l1Messenger: '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1'
  },
  unichain: {
    l1Escrow: '0x1196F688C585D3E5C895Ef8954FFB0dCDAfc566A',
    l1Messenger: '0x9A3D64E386C18Cb1d6d5179a9596A4B5736e98A6'
  }
};

/** The L1 side of Sky's Arbitrum withdrawals: the outbox executes the message once the rollup confirms it. */
export const ARBITRUM_WITHDRAWAL = {
  l1Escrow: '0xA10c7CE4b876998858b1a9E12b10092229539400',
  outbox: '0x0B9857ae2D4A3DBe74ffE1d7DF045bb7F96E4840',
  rollup: '0x4DCeB440657f21083db8aDd07665f8ddBe1DCfc0',
  /** Older outboxes the Arbitrum Bridge still allows; listed only so they can't receive a withdrawal. */
  legacyOutboxes: ['0x667e23ABd27E623c11d4CC00ca3EC4d0bD63337a', '0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40']
} as const satisfies Record<string, Address | readonly Address[]>;

/** Every L1 contract the native withdrawals touch beyond the deposit ones; none of them can receive one. */
export const NATIVE_WITHDRAWAL_CONTRACTS: readonly Address[] = [
  ...Object.values(OP_STACK_WITHDRAWAL).flatMap(contracts => Object.values(contracts)),
  ...Object.values(ARBITRUM_WITHDRAWAL).flat()
];
