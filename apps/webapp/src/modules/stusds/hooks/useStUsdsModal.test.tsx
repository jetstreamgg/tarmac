import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ launch: vi.fn() }));

// Capture the launch() config — the launcher is the unit under test.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launch })
}));

// Stub the editable body — only its props (flow/preset) are asserted via backgroundContent.
vi.mock('../components/StUsdsModalForm', () => ({
  StUsdsModalForm: ({ flow }: { flow: string }) => <div data-testid={`mock-stusds-form-${flow}`} />
}));

import { useStUsdsModal } from './useStUsdsModal';

function Harness() {
  const { openSupply, openWithdraw } = useStUsdsModal();
  return (
    <>
      <button data-testid="open-supply" onClick={() => openSupply({ amount: '100' })} />
      <button data-testid="open-withdraw" onClick={() => openWithdraw()} />
    </>
  );
}

const renderHarness = () =>
  render(
    <I18nProvider i18n={i18n}>
      <Harness />
    </I18nProvider>
  );

describe('useStUsdsModal', () => {
  beforeEach(() => h.launch.mockClear());
  afterEach(() => cleanup());

  it('opens the "Supply to stUSDS" editable modal on openSupply', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-supply'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const config = h.launch.mock.calls[0][0];
    expect(config.title).toBe('Supply to stUSDS');
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    expect(config.entry.confirmLabel).toBe('Supply');
    expect(config.entry.confirmDisabled).toBe(true);
    // The editable body is hosted OUTSIDE the dialog (backgroundContent) so its
    // in-flight hook survives minimize — not inside entry.content.
    expect(config.entry.content).toBeUndefined();
    expect(config.backgroundContent).toBeDefined();
    expect(config.backgroundContent.props.flow).toBe('supply');
    expect(config.backgroundContent.props.preset).toEqual({ amount: '100' });
  });

  it('opens the "Withdraw from stUSDS" editable modal on openWithdraw', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-withdraw'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const config = h.launch.mock.calls[0][0];
    expect(config.title).toBe('Withdraw from stUSDS');
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    expect(config.entry.confirmLabel).toBe('Withdraw');
    expect(config.entry.confirmDisabled).toBe(true);
    expect(config.entry.content).toBeUndefined();
    expect(config.backgroundContent.props.flow).toBe('withdraw');
  });

  it('mints distinct sessions for supply and withdraw so sibling modals never cross-talk', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-supply'));
    fireEvent.click(screen.getByTestId('open-withdraw'));

    const [supplyConfig] = h.launch.mock.calls[0];
    const [withdrawConfig] = h.launch.mock.calls[1];
    expect(supplyConfig.sessionId).toBeDefined();
    expect(withdrawConfig.sessionId).toBeDefined();
    expect(supplyConfig.sessionId).not.toBe(withdrawConfig.sessionId);
  });
});
