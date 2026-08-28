import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalNetworkSelect, NetworkSelect } from './NetworkSelect';

// The two rules this control adds over the ChainModal it replaced: a
// single-chain product offers no dropdown, and the pill names the chain the
// PRODUCT is on rather than the wallet's. Plus the split between the page and
// modal variants, which exists for a runtime reason nothing else catches.

const mocks = vi.hoisted(() => ({ walletChainId: 1, isSafeWallet: false, routerMounted: true }));

/** Router hooks throw outside a RouterProvider, exactly as the real ones do. */
const requireRouter = (hook: string) => {
  if (!mocks.routerMounted) throw new Error(`${hook} called outside a router`);
};

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
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => {
    requireRouter('useNavigate');
    return vi.fn();
  }
}));
vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => {
    requireRouter('useAppSearchParams');
    return [new URLSearchParams(), vi.fn()];
  },
  INTENT_PATHS: {},
  keepSearch: (prev: unknown) => prev
}));

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
  mocks.routerMounted = true;
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

// The transaction modal renders ABOVE the router: TransactionProvider wraps
// RouterProvider in pages/App.tsx. A control that reaches for router context
// from in there throws, the error boundary catches it, and the modal never
// appears — the page just seems to re-render. Hence the two variants.
describe('ModalNetworkSelect — usable where there is no router', () => {
  it('renders and switches with no router mounted', () => {
    mocks.routerMounted = false;

    render(<ModalNetworkSelect chainIds={[1, 8453]} dataTestId="net" />);
    fireEvent.keyDown(screen.getByTestId('net'), { key: 'Enter' });
    fireEvent.click(screen.getByText('Base'));

    expect(mockHandleSwitchChain).toHaveBeenCalledWith(expect.objectContaining({ chainId: 8453 }));
  });

  it('is the page variant that cannot — which is what makes the split load-bearing', () => {
    mocks.routerMounted = false;

    expect(() => render(<NetworkSelect chainIds={[1, 8453]} dataTestId="net" />)).toThrow(/outside a router/);
  });
});
