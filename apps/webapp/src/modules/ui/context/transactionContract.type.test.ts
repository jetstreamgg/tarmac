import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  isAsyncOrderConfig,
  type AsyncOrderConfig,
  type AsyncOrderStatus,
  type LaunchConfig,
  type TransactionConfig
} from './transactionContract';

// `usdValue` (APP-517) and `supportedChainIds` (APP-528) are deliberately
// required: a config missing either must not compile — see the fields' docs in
// the contract. Both variants must carry `supportedChainIds`.
const onchain: TransactionConfig = {
  title: 'Supply',
  usdValue: 0,
  supportedChainIds: [1],
  onConfirm: () => {}
};

const order: AsyncOrderConfig = {
  kind: 'async-order',
  title: 'Swap',
  supportedChainIds: [1],
  submitOrder: () => Promise.resolve('0xuid'),
  pollOrderStatus: () => Promise.resolve('open')
};

describe('transactionContract types', () => {
  it('isAsyncOrderConfig narrows a LaunchConfig by kind', () => {
    expect(isAsyncOrderConfig(order)).toBe(true);
    expect(isAsyncOrderConfig(onchain)).toBe(false);

    const check = (config: LaunchConfig) => {
      if (isAsyncOrderConfig(config)) {
        expectTypeOf(config).toEqualTypeOf<AsyncOrderConfig>();
      } else {
        expectTypeOf(config).toEqualTypeOf<TransactionConfig>();
      }
    };
    check(order);
    check(onchain);
  });

  it('AsyncOrderStatus mirrors the CoW order states', () => {
    expectTypeOf<AsyncOrderStatus>().toEqualTypeOf<
      'presignaturePending' | 'open' | 'fulfilled' | 'cancelled' | 'expired'
    >();
  });

  it('an async order submits via submitOrder, not onConfirm, and requires submit+poll', () => {
    // @ts-expect-error async orders have no onConfirm — they submit via submitOrder
    const _noConfirm = order.onConfirm;
    void _noConfirm;

    // @ts-expect-error submitOrder + pollOrderStatus are required
    const incomplete: AsyncOrderConfig = { kind: 'async-order', title: 'Swap' };
    void incomplete;
  });

  it('supportedChainIds is required on both config variants (APP-528)', () => {
    // @ts-expect-error a launch config without supportedChainIds must not compile
    const _noChainsOnchain: TransactionConfig = { title: 'Supply', usdValue: 0, onConfirm: () => {} };
    void _noChainsOnchain;

    // @ts-expect-error an async-order config without supportedChainIds must not compile
    const _noChainsOrder: AsyncOrderConfig = {
      kind: 'async-order',
      title: 'Swap',
      submitOrder: () => Promise.resolve('0xuid'),
      pollOrderStatus: () => Promise.resolve('open')
    };
    void _noChainsOrder;
  });
});
