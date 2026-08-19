import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnalyticsFlowProvider, useAnalyticsFlow } from './AnalyticsFlowContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('AnalyticsFlowContext', () => {
  it('seeds a flow_id at mount — the first funnel is joinable, never null', () => {
    const { result } = renderHook(() => useAnalyticsFlow(), { wrapper: AnalyticsFlowProvider });
    expect(result.current.getFlowId()).toMatch(UUID_RE);
  });

  it('keeps the same id across reads until rotated', () => {
    const { result } = renderHook(() => useAnalyticsFlow(), { wrapper: AnalyticsFlowProvider });
    expect(result.current.getFlowId()).toBe(result.current.getFlowId());
  });

  it('startNewFlow rotates to a fresh id', () => {
    const { result } = renderHook(() => useAnalyticsFlow(), { wrapper: AnalyticsFlowProvider });
    const first = result.current.getFlowId();
    act(() => result.current.startNewFlow());
    const second = result.current.getFlowId();
    expect(second).toMatch(UUID_RE);
    expect(second).not.toBe(first);
  });
});
