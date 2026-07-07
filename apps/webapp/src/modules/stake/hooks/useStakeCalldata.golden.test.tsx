/// <reference types="vite/client" />

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { i18n } from '@lingui/core';

i18n.load('en', {});
i18n.activate('en');

// Golden master: mock ONLY the *data* hooks the legacy provider wires itself,
// keeping every `getStake*Calldata` encoder REAL (pure viem `encodeFunctionData`,
// no network). This is what lets us assert byte-identical `Hex[]` output between
// the legacy context and the extracted pure function.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
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

import {
  StakeModuleWidgetContext,
  StakeModuleWidgetProvider
} from '@/widgets/StakeModuleWidget/context/context';
import { WidgetContext, WidgetProvider } from '@/widgets/context/WidgetContext';
import { StakeFlow } from '@/widgets/StakeModuleWidget/lib/constants';
import { generateStakeCalldata, type GenerateStakeCalldataParams } from './useStakeCalldata';

const OWNER = '0x000000000000000000000000000000000000beef' as `0x${string}`;
const FARM = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const DELEGATE = '0x2222222222222222222222222222222222222222' as `0x${string}`;

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <WidgetProvider locale="en">
      <StakeModuleWidgetProvider>{children}</StakeModuleWidgetProvider>
    </WidgetProvider>
  );
}

function renderStakeContexts() {
  return renderHook(
    () => ({
      stake: React.useContext(StakeModuleWidgetContext),
      widget: React.useContext(WidgetContext)
    }),
    { wrapper }
  );
}

/** Defaults for a scenario; override only the dimensions a case exercises. */
function scenario(overrides: Partial<GenerateStakeCalldataParams>): GenerateStakeCalldataParams {
  return {
    flow: 'open',
    ownerAddress: OWNER,
    urnIndex: 0n,
    urnAddress: undefined,
    skyToLock: 0n,
    skyToFree: 0n,
    usdsToWipe: 0n,
    wipeAll: false,
    usdsToBorrow: 0n,
    selectedRewardContract: undefined,
    selectedDelegate: undefined,
    urnSelectedRewardContract: undefined,
    urnSelectedVoteDelegate: undefined,
    rewardContractsToClaim: undefined,
    restakeSkyRewards: false,
    restakeSkyAmount: 0n,
    referralCode: 0,
    ...overrides
  };
}

/**
 * Drives the legacy provider with the OPEN-flow-relevant setters from `params`,
 * then returns the legacy `generateAllCalldata` output. urn-selected values and
 * `activeUrn` stay at their OPEN defaults (undefined) — the mocked data hooks
 * return `undefined` and no `setActiveUrn` is called. MANAGE driving arrives in
 * a later slice.
 */
function legacyOpenOutput(params: GenerateStakeCalldataParams): `0x${string}`[] {
  const { result } = renderStakeContexts();
  act(() => {
    result.current.widget.setWidgetState(prev => ({ ...prev, flow: StakeFlow.OPEN }));
    result.current.stake.setSkyToLock(params.skyToLock);
    result.current.stake.setUsdsToBorrow(params.usdsToBorrow);
    result.current.stake.setSelectedRewardContract(params.selectedRewardContract);
    result.current.stake.setSelectedDelegate(params.selectedDelegate);
  });
  return result.current.stake.generateAllCalldata(params.ownerAddress, params.urnIndex, params.referralCode);
}

describe('generateStakeCalldata — OPEN flow golden parity vs legacy context', () => {
  it('open + lock only', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    expect(generateStakeCalldata(params)).toEqual(legacyOpenOutput(params));
    expect(generateStakeCalldata(params).length).toBeGreaterThan(0);
  });

  it('open + lock + draw + farm + delegate (full OPEN scenario)', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      usdsToBorrow: 500_000n,
      selectedRewardContract: FARM,
      selectedDelegate: DELEGATE
    });
    const legacy = legacyOpenOutput(params);
    const pure = generateStakeCalldata(params);
    expect(pure).toEqual(legacy);
    // open, lock, draw, selectFarm, selectDelegate — five distinct calls
    expect(pure).toHaveLength(5);
  });

  it('open with a custom referralCode threads it into lock + selectFarm', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      selectedRewardContract: FARM,
      referralCode: 12345
    });
    expect(generateStakeCalldata(params)).toEqual(legacyOpenOutput(params));
  });

  it('open with the default-0 referralCode matches legacy', () => {
    const params = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      selectedRewardContract: FARM,
      referralCode: 0
    });
    expect(generateStakeCalldata(params)).toEqual(legacyOpenOutput(params));
  });

  it('emits the open calldata first when urnAddress is undefined (new position)', () => {
    const params = scenario({ flow: 'open', skyToLock: 1_000_000n });
    const pure = generateStakeCalldata(params);
    const legacy = legacyOpenOutput(params);
    // The legacy provider has no activeUrn in OPEN, so both begin with `open`.
    expect(pure[0]).toBe(legacy[0]);
    expect(pure).toEqual(legacy);
  });
});

describe('generateStakeCalldata — OPEN lock term (no isSkyRewardPosition guard)', () => {
  it('adds restakeSkyAmount to the lock term when restakeSkyRewards is on', () => {
    const withRestake = scenario({
      flow: 'open',
      skyToLock: 1_000_000n,
      restakeSkyRewards: true,
      restakeSkyAmount: 250_000n
    });
    const withoutRestake = scenario({ flow: 'open', skyToLock: 1_250_000n });
    // Same total lock amount → identical encoded lock calldata.
    expect(generateStakeCalldata(withRestake)).toEqual(generateStakeCalldata(withoutRestake));
  });
});
