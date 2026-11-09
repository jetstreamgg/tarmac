import { describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import {
  bridgeEventContext,
  bridgeTransactionAnalytics,
  createBridgeTracker,
  type BridgeTrackerOptions
} from './bridgeTracker';

const inner = (overrides: Partial<TxCallbacks> = {}): TxCallbacks => ({
  onMutate: vi.fn(),
  onStart: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
  ...overrides
});

const setup = (options: Partial<BridgeTrackerOptions> = {}) => {
  const emitTxSent = vi.fn();
  const tracker = createBridgeTracker({
    mainAction: 'send',
    swapFunction: 'swapExactIn',
    swapTokens: { token_in: 'USDS', token_out: 'USDC' },
    includesSwap: true,
    isSafe: false,
    emitTxSent,
    ...options
  });
  return { tracker, emitTxSent };
};

describe('bridgeEventContext', () => {
  it('names the direction by the source network', () => {
    const base = { kind: 'native', token: 'USDS', amount: 1 } as const;
    expect(bridgeEventContext({ ...base, from: 'ethereum', to: 'base' }).flow).toBe('ethereum-to-l2');
    expect(bridgeEventContext({ ...base, from: 'base', to: 'ethereum' }).flow).toBe('l2-to-ethereum');
  });
});

describe('stepOf', () => {
  it('reports each leg as its real step', () => {
    const { tracker } = setup();
    expect(tracker.stepOf({ functionName: 'approve' }, 'f').action).toBe('approve');
    expect(tracker.stepOf({ functionName: 'swapExactIn' }, 'f').action).toBe('swap');
    expect(tracker.stepOf({ functionName: 'depositForBurn' }, 'f').action).toBe('send');
  });

  it('reports a bundle, which names no function, as the main action', () => {
    const { tracker } = setup();
    expect(tracker.stepOf(undefined, 'f')).toMatchObject({
      action: 'send',
      data: { is_bundled: true, includes_swap: true }
    });
  });

  it('adds the tokens to a swap and a conversion only', () => {
    expect(setup().tracker.stepOf({ functionName: 'swapExactIn' }, 'f').data).toMatchObject({
      token_in: 'USDS',
      token_out: 'USDC'
    });
    expect(setup().tracker.stepOf({ functionName: 'approve' }, 'f').data).not.toHaveProperty('token_in');
    expect(
      setup({ mainAction: 'convert', swapFunction: undefined }).tracker.stepOf(
        { functionName: 'sellGem' },
        'f'
      )
    ).toMatchObject({ action: 'convert', data: { token_in: 'USDS' } });
  });

  it('does not take a missing swap function for a bundle leg', () => {
    const { tracker } = setup({ mainAction: 'prove', swapFunction: undefined });
    expect(tracker.stepOf({ functionName: 'proveWithdrawalTransaction' }, 'f').action).toBe('prove');
  });
});

describe('wrap', () => {
  it('passes every callback through, the wrapped one first', () => {
    const order: string[] = [];
    const callbacks = inner({
      onMutate: () => order.push('mutate'),
      onStart: () => order.push('start')
    });
    const { tracker, emitTxSent } = setup();
    emitTxSent.mockImplementation(() => order.push('emit'));
    const wrapped = tracker.wrap(callbacks);

    wrapped.onMutate({ functionName: 'depositForBurn' });
    wrapped.onStart('0xa');
    wrapped.onSuccess('0xa', 1n);
    wrapped.onError(new Error('x'), '0xa');

    expect(order).toEqual(['mutate', 'start', 'emit']);
    expect(callbacks.onSuccess).toHaveBeenCalledWith('0xa', 1n);
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
  });

  it('carries the bridge id its own callback records as the send starts', () => {
    const { tracker, emitTxSent } = setup();
    const wrapped = tracker.wrap(inner({ onStart: hash => tracker.recordBridge(hash!, hash) }));

    tracker.stepOf({ functionName: 'depositForBurn' }, 'flow-1');
    wrapped.onMutate({ functionName: 'depositForBurn' });
    wrapped.onStart('0xburn');

    expect(emitTxSent).toHaveBeenCalledExactlyOnceWith({
      action: 'send',
      hash_kind: 'tx',
      tx_hash: '0xburn',
      flow_id: 'flow-1',
      bridge_id: '0xburn',
      source_tx_hash: '0xburn'
    });
  });

  it('reports an approve with its step and no bridge yet', () => {
    const { tracker, emitTxSent } = setup();
    const wrapped = tracker.wrap(inner());
    wrapped.onMutate({ functionName: 'approve' });
    wrapped.onStart('0xapprove');
    expect(emitTxSent.mock.calls[0][0]).toMatchObject({
      action: 'approve',
      tx_hash: '0xapprove',
      bridge_id: undefined
    });
  });

  it('counts a hash reported twice once, and a speed-up again', () => {
    const { tracker, emitTxSent } = setup();
    const wrapped = tracker.wrap(
      inner({
        onStart: hash => {
          if (hash === '0xfast') tracker.recordRepriced(hash);
        }
      })
    );
    wrapped.onMutate({ functionName: 'depositForBurn' });
    tracker.recordBridge('0xslow', '0xslow');
    wrapped.onStart('0xslow');
    wrapped.onStart('0xslow');
    wrapped.onStart('0xfast');

    expect(emitTxSent).toHaveBeenCalledTimes(2);
    expect(emitTxSent.mock.calls[1][0]).toMatchObject({
      tx_hash: '0xfast',
      bridge_id: '0xslow',
      source_tx_hash: '0xfast'
    });
  });

  it('names a bundle by its id, once', () => {
    const { tracker, emitTxSent } = setup({ readBundleId: () => 'bundle-1' });
    const wrapped = tracker.wrap(inner());
    wrapped.onMutate(undefined);
    wrapped.onStart(undefined);
    wrapped.onStart(undefined);
    expect(emitTxSent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ action: 'send', hash_kind: 'bundle', tx_hash: 'bundle-1' })
    );
  });

  it('marks a Safe hash as such', () => {
    const { tracker, emitTxSent } = setup({ isSafe: true });
    const wrapped = tracker.wrap(inner());
    wrapped.onMutate({ functionName: 'depositForBurn' });
    wrapped.onStart('0xsafe');
    expect(emitTxSent.mock.calls[0][0]).toMatchObject({ hash_kind: 'safe', tx_hash: '0xsafe' });
  });

  it('still reports a signature whose modal closed', () => {
    const { tracker, emitTxSent } = setup();
    const detached = tracker.wrap(inner());
    detached.onMutate({ functionName: 'depositForBurn' });
    detached.onStart('0xlate');
    expect(emitTxSent).toHaveBeenCalledTimes(1);
  });
});

describe('the real hash of a Safe transaction or bundle', () => {
  it('is reported again under the same bridge id', () => {
    const { tracker, emitTxSent } = setup({ isSafe: true });
    tracker.stepOf({ functionName: 'depositForBurn' }, 'flow-1');
    tracker.recordBridge('0xsafe');
    tracker.recordExecuted('0xreal');
    expect(emitTxSent).toHaveBeenCalledExactlyOnceWith({
      action: 'send',
      hash_kind: 'tx',
      tx_hash: '0xreal',
      flow_id: 'flow-1',
      bridge_id: '0xsafe',
      source_tx_hash: '0xreal'
    });
  });
});

describe('completedData', () => {
  it('says what the attempt ran and the bridge it belongs to', () => {
    const { tracker } = setup({ walletName: 'Rabby', bridgeId: 'card', sourceTxHash: '0xsrc' });
    tracker.wrap(inner()).onMutate(undefined);
    expect(tracker.completedData()).toEqual({
      is_bundled: true,
      includes_swap: true,
      bridge_id: 'card',
      source_tx_hash: '0xsrc',
      wallet_name: 'Rabby'
    });
  });
});

describe('bridgeTransactionAnalytics', () => {
  const context = bridgeEventContext({
    kind: 'cctp',
    from: 'base',
    to: 'ethereum',
    token: 'USDS',
    amount: 5
  });

  it('reports nothing of its own before a Confirm', () => {
    const analytics = bridgeTransactionAnalytics(context, 'send', () => undefined);
    expect(analytics.stepOf?.({ functionName: 'approve' }, 'f')).toBeUndefined();
    expect(analytics.completedData?.()).toBeUndefined();
  });

  it('reads the latest Confirm, and carries the context on every event', () => {
    const { tracker } = setup();
    const analytics = bridgeTransactionAnalytics(context, 'send', () => tracker, {
      route_selection: 'default'
    });
    expect(analytics).toMatchObject({
      widgetName: 'bridge',
      flow: 'l2-to-ethereum',
      action: 'send',
      data: { bridge_type: 'cctp', source_chain: 'base', route_selection: 'default' }
    });
    expect(analytics.stepOf?.({ functionName: 'swapExactIn' }, 'f')?.action).toBe('swap');
  });
});
