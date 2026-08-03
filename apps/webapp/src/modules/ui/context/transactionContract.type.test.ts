import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  isAsyncOrderConfig,
  type AsyncOrderConfig,
  type AsyncOrderStatus,
  type LaunchConfig,
  type TransactionConfig
} from './transactionContract';

const onchain: TransactionConfig = { title: 'Supply', onConfirm: () => {} };

const order: AsyncOrderConfig = {
  kind: 'async-order',
  title: 'Swap',
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
});
