import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const MAINNET = { id: 1, name: 'Ethereum' };
const TENDERLY = { id: 314310, name: 'Tenderly' };
const BASE = { id: 8453, name: 'Base' };

const h = vi.hoisted(() => ({ chains: [] as { id: number; name: string }[] }));

// Spread over the real module: `lib/utils` reaches the wagmi config, which
// needs the rest of wagmi's exports at import time.
vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => h.chains,
    useClient: () => ({ chain: { name: 'Ethereum' } })
  };
});

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => [new URLSearchParams(), vi.fn()],
  INTENT_PATHS: {},
  keepSearch: (params: unknown) => params
}));

vi.mock('@/hooks', () => ({ useIsSafeWallet: () => false }));

vi.mock('@/modules/ui/context/ChainModalContext', () => ({
  useChainModalContext: () => ({ handleSwitchChain: vi.fn(), isPending: false, variables: undefined })
}));

import { ChainModal } from './ChainModal';

const renderModal = (chainIds?: number[]) =>
  render(
    <I18nProvider i18n={i18n}>
      <ChainModal chainIds={chainIds} dataTestId="network-pill" />
    </I18nProvider>
  );

describe('ChainModal', () => {
  afterEach(cleanup);

  it('is a dropdown when there is more than one chain to switch to', () => {
    h.chains = [MAINNET, BASE];
    renderModal([MAINNET.id, BASE.id]);

    const trigger = screen.getByTestId('network-pill');
    expect(trigger.tagName).toBe('BUTTON');
    // Chain icon + chevron.
    expect(trigger.querySelectorAll('svg')).toHaveLength(2);

    fireEvent.click(trigger);
    expect(screen.getByText('Switch network')).toBeTruthy();
  });

  it('is an inert label when the product runs on a single chain', () => {
    h.chains = [MAINNET, BASE];
    renderModal([MAINNET.id]);

    const pill = screen.getByTestId('network-pill');
    expect(pill.tagName).not.toBe('BUTTON');
    // The chain icon alone — no chevron.
    expect(pill.querySelectorAll('svg')).toHaveLength(1);
    expect(pill.className).toContain('pointer-events-none');
    expect(pill.textContent).toContain('Ethereum');

    fireEvent.click(pill);
    expect(screen.queryByText('Switch network')).toBeNull();
  });

  it('stays a dropdown for a mainnet-only product once the dev fork is configured', () => {
    // What the dev/e2e wagmi config looks like: the Tenderly fork joins the
    // mainnet family, so single-chain products still have somewhere to switch.
    h.chains = [MAINNET, TENDERLY, BASE];
    renderModal([MAINNET.id, TENDERLY.id]);

    const trigger = screen.getByTestId('network-pill');
    expect(trigger.tagName).toBe('BUTTON');

    fireEvent.click(trigger);
    expect(screen.getByText('Switch network')).toBeTruthy();
  });
});
