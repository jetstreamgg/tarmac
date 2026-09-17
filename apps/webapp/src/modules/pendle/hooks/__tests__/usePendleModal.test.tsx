/// <reference types="vite/client" />

import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type { PendleMarketConfig } from '@/hooks';

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1795651200
};

const hoisted = vi.hoisted(() => ({ launchMock: vi.fn() }));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: hoisted.launchMock })
}));

vi.mock('../../components/PendleModalForm', () => ({
  PendleModalForm: () => null
}));

import { usePendleModal } from '../usePendleModal';
import { PendleModalForm } from '../../components/PendleModalForm';

type Launch = { sessionId?: string; supportedChainIds: number[]; render: () => ReactElement };
type FormElement = ReactElement<{ flow: string; market: PendleMarketConfig; onSuccess?: () => void }>;
const launched = (n = 0) => hoisted.launchMock.mock.calls[n][0] as Launch;
const formOf = (launch: Launch) => launch.render() as FormElement;

describe('usePendleModal', () => {
  beforeEach(() => hoisted.launchMock.mockClear());
  afterEach(() => cleanup());

  it('launches the supply form for the market', () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => usePendleModal({ onSuccess }));
    act(() => result.current.openSupply(MARKET));

    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    expect(launched().sessionId).toBeTruthy();
    expect(launched().supportedChainIds).toContain(1);
    const form = formOf(launched());
    expect(form.type).toBe(PendleModalForm);
    expect(form.props.flow).toBe('supply');
    expect(form.props.market).toBe(MARKET);
    expect(form.props.onSuccess).toBe(onSuccess);
  });

  it('launches the withdraw form for the market', () => {
    const { result } = renderHook(() => usePendleModal());
    act(() => result.current.openWithdraw(MARKET));
    expect(formOf(launched()).props.flow).toBe('withdraw');
  });

  it('uses distinct sessions for supply and withdraw', () => {
    const { result } = renderHook(() => usePendleModal());
    act(() => result.current.openSupply(MARKET));
    act(() => result.current.openWithdraw(MARKET));
    expect(launched(0).sessionId).not.toBe(launched(1).sessionId);
  });
});
