import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsFlowProvider } from '../context/AnalyticsFlowContext';
import { useWidgetAnalytics } from './useWidgetAnalytics';
import { WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { capturedEventsNamed, clearCapturedEvents, lastCapturedEvent } from '@/test/analyticsCapture';

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});
vi.mock('wagmi', () => ({
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001' }),
  useChains: () => [{ id: 1, name: 'Ethereum' }]
}));

const renderWidgetAnalytics = (widgetName = 'savings') =>
  renderHook(() => useWidgetAnalytics(widgetName, 1), { wrapper: AnalyticsFlowProvider });

// EIP-1193 user rejection, nested the way viem wraps it
const userRejectionError = () =>
  Object.assign(new Error('Transaction failed'), {
    cause: { code: 4001, message: 'User rejected the request. Details: 0xdeadbeef calldata' }
  });

describe('useWidgetAnalytics', () => {
  beforeEach(() => clearCapturedEvents());

  it('emits the full envelope with a signed negative amount on withdraw', () => {
    const { result } = renderWidgetAnalytics();
    act(() =>
      result.current({
        event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
        action: 'withdraw',
        flow: 'withdraw',
        txHash: '0xhash',
        amount: 250,
        data: { module: 'savings' }
      })
    );

    const captured = lastCapturedEvent('app_widget_flow_completed');
    expect(captured?.properties).toMatchObject({
      widget_name: 'savings',
      chain_id: 1,
      chain_name: 'Ethereum',
      tx_status: 'success',
      tx_hash: '0xhash',
      amount: -250,
      module: 'savings',
      flow: 'withdraw'
    });
    expect(captured?.properties.flow_id).toBeTruthy();
    expect(captured?.properties.timestamp).toBeTruthy();
  });

  it('records a wallet rejection as cancelled, not error (D1)', () => {
    const { result } = renderWidgetAnalytics();
    act(() =>
      result.current({
        event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
        action: 'supply',
        flow: 'supply',
        error: userRejectionError()
      })
    );

    const captured = lastCapturedEvent('app_widget_flow_completed');
    expect(captured?.properties).toMatchObject({
      tx_status: 'cancelled',
      error_kind: 'user_rejected',
      is_user_rejection: true
    });
  });

  it('records an on-chain revert as error with bounded classification, never the raw message', () => {
    const { result } = renderWidgetAnalytics();
    const revert = Object.assign(new Error('execution reverted: secret calldata 0xbeef'), {
      name: 'ContractFunctionExecutionError'
    });
    act(() =>
      result.current({
        event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
        action: 'supply',
        flow: 'supply',
        txHash: '0xhash',
        error: revert
      })
    );

    const captured = lastCapturedEvent('app_widget_flow_completed');
    expect(captured?.properties).toMatchObject({
      tx_status: 'error',
      error_kind: 'reverted',
      is_user_rejection: false,
      error_name: 'ContractFunctionExecutionError'
    });
    expect(JSON.stringify(captured?.properties)).not.toContain('secret calldata');
  });

  it('rotates the flow_id after a terminal event but not after review_viewed', () => {
    const { result } = renderWidgetAnalytics();
    act(() =>
      result.current({ event: WidgetAnalyticsEventType.REVIEW_VIEWED, action: 'supply', flow: 'supply' })
    );
    act(() =>
      result.current({
        event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
        action: 'supply',
        flow: 'supply'
      })
    );
    act(() =>
      result.current({
        event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
        action: 'supply',
        flow: 'supply',
        txHash: '0xhash'
      })
    );
    act(() =>
      result.current({ event: WidgetAnalyticsEventType.REVIEW_VIEWED, action: 'supply', flow: 'supply' })
    );

    const review = capturedEventsNamed('app_widget_review_viewed');
    const started = capturedEventsNamed('app_widget_flow_started');
    const completed = capturedEventsNamed('app_widget_flow_completed');

    // The whole funnel shares one non-null id; the NEXT flow gets a fresh one.
    expect(review[0].properties.flow_id).toBeTruthy();
    expect(started[0].properties.flow_id).toBe(review[0].properties.flow_id);
    expect(completed[0].properties.flow_id).toBe(review[0].properties.flow_id);
    expect(review[1].properties.flow_id).not.toBe(review[0].properties.flow_id);
  });
});
