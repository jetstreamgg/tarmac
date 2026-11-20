import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeErrorResult } from 'viem';
import { resetPrepareRevertTracking, trackPrepareReverted } from './trackPrepareReverted';
import { capturedEventsNamed, clearCapturedEvents } from '@/test/analyticsCapture';

vi.mock('../PostHogProvider', () => ({ POSTHOG_ENABLED: true }));

const rpcRevert = (reason: string) =>
  Object.assign(new Error('execution reverted'), {
    data: encodeErrorResult({
      abi: [{ type: 'error', name: 'Error', inputs: [{ name: 'message', type: 'string' }] }],
      errorName: 'Error',
      args: [reason]
    })
  });

describe('trackPrepareReverted', () => {
  beforeEach(() => {
    resetPrepareRevertTracking();
    clearCapturedEvents();
  });

  it('captures a protocol revert with its reason and whether it had copy', () => {
    trackPrepareReverted(rpcRevert('LockstakeEngine/urn-unsafe'), 1);

    const events = capturedEventsNamed('app_transaction_prepare_reverted');
    expect(events).toHaveLength(1);
    expect(events[0].properties).toMatchObject({
      revert_reason: 'LockstakeEngine/urn-unsafe',
      revert_kind: 'error',
      revert_has_copy: true,
      chain_id: 1,
      viewport: expect.any(String)
    });
  });

  it('captures an unmapped reason too, flagged as shown verbatim', () => {
    trackPrepareReverted(rpcRevert('Foo/bar-baz'), 1);
    expect(capturedEventsNamed('app_transaction_prepare_reverted')[0].properties).toMatchObject({
      revert_reason: 'Foo/bar-baz',
      revert_has_copy: false
    });
  });

  it('captures each chain and reason once, however often simulation re-runs', () => {
    trackPrepareReverted(rpcRevert('LockstakeEngine/urn-unsafe'), 1);
    trackPrepareReverted(rpcRevert('LockstakeEngine/urn-unsafe'), 1);
    trackPrepareReverted(rpcRevert('LockstakeEngine/urn-unsafe'), 8453);
    trackPrepareReverted(rpcRevert('Vat/ceiling-exceeded'), 1);

    expect(capturedEventsNamed('app_transaction_prepare_reverted')).toHaveLength(3);
  });

  it('skips reverts the typed amount causes', () => {
    trackPrepareReverted(rpcRevert('Sky/insufficient-balance'), 1);
    trackPrepareReverted(rpcRevert('Vat/dust'), 1);
    expect(capturedEventsNamed('app_transaction_prepare_reverted')).toHaveLength(0);
  });

  it('skips errors that carry no revert', () => {
    trackPrepareReverted(new Error('HTTP request failed'), 1);
    trackPrepareReverted(null, 1);
    expect(capturedEventsNamed('app_transaction_prepare_reverted')).toHaveLength(0);
  });
});
