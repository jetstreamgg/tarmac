import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkSelect } from './NetworkSelect';

// The two rules this control adds over the ChainModal it replaced: a
// single-chain product offers no dropdown, and the pill names the chain the
// PRODUCT is on rather than the wallet's.
//
// NOTE the router is deliberately NOT mocked here, and that absence is itself
// an assertion. A transaction modal renders above RouterProvider, so the moment
// this control reaches for router context these renders start throwing — which
// is the bug where the savings modal never opened and the page just re-rendered.

const mocks = vi.hoisted(() => ({ walletChainId: 1, isSafeWallet: false }));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => mocks.walletChainId,
  useChains: () => [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' },
    { id: 42161, name: 'Arbitrum One' }
  ]
}));
vi.mock('@/hooks', () => ({ useIsSafeWallet: () => mocks.isSafeWallet }));

const mockHandleSwitchChain = vi.fn();
vi.mock('@/modules/ui/context/ChainModalContext', () => ({
  useChainModalContext: () => ({
    handleSwitchChain: mockHandleSwitchChain,
    isPending: false,
    variables: undefined
  })
}));

beforeEach(() => {
  mocks.walletChainId = 1;
  mocks.isSafeWallet = false;
  mockHandleSwitchChain.mockClear();
});
afterEach(cleanup);

describe('NetworkSelect', () => {
  it('offers the product’s chains and switches to the one picked', () => {
    render(<NetworkSelect chainIds={[1, 8453, 42161]} dataTestId="net" />);

    const trigger = screen.getByTestId('net');
    expect(trigger.tagName).toBe('BUTTON');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(screen.getByText('Base'));

    expect(mockHandleSwitchChain).toHaveBeenCalledWith(expect.objectContaining({ chainId: 8453 }));
  });

  it('renders a non-interactive pill when the product runs on one chain', () => {
    render(<NetworkSelect chainIds={[1]} dataTestId="net" />);

    const pill = screen.getByTestId('net');
    // A span, not a disabled button: there is no action, so nothing should take
    // focus or announce itself as a control.
    expect(pill.tagName).toBe('SPAN');
    expect(pill.textContent).toContain('Ethereum');
    expect(pill.querySelector('.lucide-chevron-down')).toBeNull();
  });

  it('names the product’s chain, not the wallet’s, when the wallet is elsewhere', () => {
    // Wallet on Arbitrum, looking at a mainnet-only product: the old pill said
    // "Arbitrum One" on a page that cannot operate there.
    mocks.walletChainId = 42161;

    render(<NetworkSelect chainIds={[1]} dataTestId="net" />);

    expect(screen.getByTestId('net').textContent).toContain('Ethereum');
  });

  it('goes static for a Safe wallet — its chain is fixed by the Safe app', () => {
    mocks.isSafeWallet = true;

    render(<NetworkSelect chainIds={[1, 8453]} dataTestId="net" />);

    expect(screen.getByTestId('net').tagName).toBe('SPAN');
  });
});

// The savings modal never opened because this control reached for router
// context from inside a modal, which renders above RouterProvider. Nothing in
// this file mocks the router, so the render below is the pin: re-introduce a
// useNavigate/useAppSearchParams call and these tests start failing.
describe('NetworkSelect — needs no router', () => {
  it('renders and switches with no router in the tree', () => {
    render(<NetworkSelect chainIds={[1, 8453]} dataTestId="net" />);
    fireEvent.keyDown(screen.getByTestId('net'), { key: 'Enter' });
    fireEvent.click(screen.getByText('Base'));

    expect(mockHandleSwitchChain).toHaveBeenCalledWith({ chainId: 8453 });
  });
});
