import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@/hooks';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ launch: vi.fn() }));

// Capture the launch() config — the launcher is the unit under test.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launch })
}));

// Stub the flow — only the props it is launched with are asserted.
vi.mock('../components/VaultFlow', () => ({
  VaultFlow: ({ flow }: { flow: string }) => <div data-testid={`mock-vault-form-${flow}`} />
}));

import { useVaultModal } from './useVaultModal';

const ASSET = { symbol: 'USDC', address: { 1: '0xusdc' } } as unknown as Token;
const ARGS = {
  vaultAddress: '0xvault' as `0x${string}`,
  assetToken: ASSET,
  vaultName: 'USDC Risk Capital',
  netRate: 0.0445
};

function Harness() {
  const { openSupply, openWithdraw } = useVaultModal();
  return (
    <>
      <button data-testid="open-supply" onClick={() => openSupply(ARGS)} />
      <button data-testid="open-withdraw" onClick={() => openWithdraw(ARGS)} />
    </>
  );
}

const renderHarness = () =>
  render(
    <I18nProvider i18n={i18n}>
      <Harness />
    </I18nProvider>
  );

describe('useVaultModal', () => {
  beforeEach(() => h.launch.mockClear());
  afterEach(() => cleanup());

  it('launches the supply flow for the vault, guarded to mainnet', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-supply'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const options = h.launch.mock.calls[0][0];
    expect(options.supportedChainIds).toEqual(MAINNET_FAMILY_CHAIN_IDS);
    expect(options.flow.props.flow).toBe('supply');
    expect(options.flow.props.vaultName).toBe('USDC Risk Capital');
    expect(options.flow.props.vaultAddress).toBe('0xvault');
  });

  it('launches the withdraw flow in its own session', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-supply'));
    fireEvent.click(screen.getByTestId('open-withdraw'));

    const [supply, withdraw] = h.launch.mock.calls.map(call => call[0]);
    expect(withdraw.flow.props.flow).toBe('withdraw');
    expect(withdraw.sessionId).not.toBe(supply.sessionId);
  });
});
