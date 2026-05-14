/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { i18n } from '@lingui/core';

i18n.load('en', {});
i18n.activate('en');

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    getSaOpenCalldata: () => '0xopen' as `0x${string}`,
    getSaWipeCalldata: () => '0xwipe' as `0x${string}`,
    getSaWipeAllCalldata: () => '0xwipeall' as `0x${string}`,
    getSaFreeMkrCalldata: () => '0xfreemkr' as `0x${string}`,
    useUrnSelectedRewardContract: () => ({ data: undefined, refetch: () => {} }),
    useUrnSelectedVoteDelegate: () => ({ data: undefined, refetch: () => {} })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

import { SealModuleWidgetContext, SealModuleWidgetProvider } from './context';
import { WidgetProvider } from '@/widgets/context/WidgetContext';

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WidgetProvider locale="en">
      <SealModuleWidgetProvider>{children}</SealModuleWidgetProvider>
    </WidgetProvider>
  );
}

describe('SealModule generateAllCalldata calldata-purity (no referrer field)', () => {
  it('generateAllCalldata accepts only (ownerAddress, urnIndex) and returns calldata bytes', () => {
    const { result } = renderHook(() => React.useContext(SealModuleWidgetContext), { wrapper });
    const owner = '0x000000000000000000000000000000000000beef' as `0x${string}`;
    const cd = result.current.generateAllCalldata(owner, 0n);
    expect(Array.isArray(cd)).toBe(true);
    expect(cd.every(b => typeof b === 'string' && b.startsWith('0x'))).toBe(true);
    expect(result.current.generateAllCalldata.length).toBe(2);
  });
});
