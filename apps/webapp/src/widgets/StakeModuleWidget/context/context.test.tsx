/// <reference types="vite/client" />

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { i18n } from '@lingui/core';

i18n.load('en', {});
i18n.activate('en');

const captured = {
  stakeLock: undefined as Record<string, unknown> | undefined,
  stakeSelectRewardContract: undefined as Record<string, unknown> | undefined
};

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    getStakeLockCalldata: (params: Record<string, unknown>) => {
      captured.stakeLock = params;
      return '0xdeadbeef' as `0x${string}`;
    },
    getStakeSelectRewardContractCalldata: (params: Record<string, unknown>) => {
      captured.stakeSelectRewardContract = params;
      return '0xcafebabe' as `0x${string}`;
    },
    getStakeOpenCalldata: () => '0x01' as `0x${string}`,
    getStakeFreeCalldata: () => '0x02' as `0x${string}`,
    getStakeWipeCalldata: () => '0x03' as `0x${string}`,
    getStakeWipeAllCalldata: () => '0x04' as `0x${string}`,
    getStakeDrawCalldata: () => '0x05' as `0x${string}`,
    getStakeSelectDelegateCalldata: () => '0x06' as `0x${string}`,
    getStakeGetRewardCalldata: () => '0x07' as `0x${string}`,
    useRewardContractsToClaim: () => ({ data: undefined, isLoading: false }),
    useStakeRewardContracts: () => ({ data: undefined, isLoading: false, error: null }),
    useStakeUrnSelectedRewardContract: () => ({ data: undefined, refetch: () => {} }),
    useStakeUrnSelectedVoteDelegate: () => ({ data: undefined, refetch: () => {} })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

import { StakeModuleWidgetContext, StakeModuleWidgetProvider } from './context';
import { WidgetProvider } from '@/widgets/context/WidgetContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WidgetProvider locale="en">
      <StakeModuleWidgetProvider>{children}</StakeModuleWidgetProvider>
    </WidgetProvider>
  );
}

describe('StakeModule generateAllCalldata referralCode contract-arg', () => {
  beforeEach(() => {
    captured.stakeLock = undefined;
    captured.stakeSelectRewardContract = undefined;
  });

  it('passes refCode under `refCode:` as a number into getStakeLockCalldata when locking SKY', () => {
    const { result } = renderHook(() => React.useContext(StakeModuleWidgetContext), { wrapper });
    act(() => {
      result.current.setSkyToLock(1_000_000n);
    });
    const owner = '0x000000000000000000000000000000000000beef' as `0x${string}`;
    const calldata = result.current.generateAllCalldata(owner, 0n, 12345);
    expect(captured.stakeLock?.refCode).toBe(12345);
    expect(typeof captured.stakeLock?.refCode).toBe('number');
    expect(calldata.length).toBeGreaterThan(0);
  });

  it('defaults refCode to 0 when generateAllCalldata is called without referralCode', () => {
    const { result } = renderHook(() => React.useContext(StakeModuleWidgetContext), { wrapper });
    act(() => {
      result.current.setSkyToLock(1_000_000n);
    });
    const owner = '0x000000000000000000000000000000000000beef' as `0x${string}`;
    result.current.generateAllCalldata(owner, 0n);
    expect(captured.stakeLock?.refCode).toBe(0);
  });
});
