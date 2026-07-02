import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Token } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ launch: vi.fn() }));

// Capture the launch() config — the launcher is the unit under test.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launch })
}));

// Stub the editable body — only its props (flow) are asserted via backgroundContent.
vi.mock('../components/VaultModalForm', () => ({
  VaultModalForm: ({ flow }: { flow: string }) => <div data-testid={`mock-vault-form-${flow}`} />
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

  it('opens the "Supply to {vault}" editable modal on openSupply', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-supply'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const config = h.launch.mock.calls[0][0];
    expect(config.title).toBe('Supply to USDC Risk Capital');
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    expect(config.entry.confirmLabel).toBe('Supply');
    expect(config.entry.confirmDisabled).toBe(true);
    // The editable body is hosted OUTSIDE the dialog (backgroundContent) so its
    // in-flight hook survives minimize — not inside entry.content.
    expect(config.entry.content).toBeUndefined();
    expect(config.backgroundContent).toBeDefined();
    expect(config.backgroundContent.props.flow).toBe('supply');
    expect(config.backgroundContent.props.vaultName).toBe('USDC Risk Capital');
  });

  it('opens the "Withdraw from {vault}" editable modal on openWithdraw', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-withdraw'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const config = h.launch.mock.calls[0][0];
    expect(config.title).toBe('Withdraw from USDC Risk Capital');
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    expect(config.entry.confirmLabel).toBe('Withdraw');
    expect(config.entry.confirmDisabled).toBe(true);
    expect(config.entry.content).toBeUndefined();
    expect(config.backgroundContent.props.flow).toBe('withdraw');
  });
});
