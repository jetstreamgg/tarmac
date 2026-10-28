import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAINNET_FAMILY_CHAIN_IDS } from '@/lib/chainAvailability';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({ launch: vi.fn() }));

// Capture the launch() config — the launcher is the unit under test.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: h.launch })
}));

// Stub the flow — only the props it is launched with are asserted.
vi.mock('../components/StUsdsFlow', () => ({
  StUsdsFlow: ({ flow }: { flow: string }) => <div data-testid={`mock-stusds-form-${flow}`} />
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

  it('launches the supply flow with its preset, guarded to mainnet', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-supply'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const options = h.launch.mock.calls[0][0];
    expect(options.supportedChainIds).toEqual(MAINNET_FAMILY_CHAIN_IDS);
    expect(options.flow.props.flow).toBe('supply');
    expect(options.flow.props.preset).toEqual({ amount: '100' });
  });

  it('launches the withdraw flow', () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('open-withdraw'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    expect(h.launch.mock.calls[0][0].flow.props.flow).toBe('withdraw');
  });
});
