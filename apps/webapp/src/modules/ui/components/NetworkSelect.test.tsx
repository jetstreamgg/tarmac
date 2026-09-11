import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkBadge, NetworkSelect, useIsNetworkSelectStatic, useNetworkTitleBadge } from './NetworkSelect';
import { BP } from '@/hooks/ui/useBreakpoint';
import { renderHook } from '@testing-library/react';

// The two rules this control adds over the ChainModal it replaced: a
// single-chain product offers no dropdown, and the pill names the chain the
// PRODUCT is on rather than the wallet's.
//
// NOTE the router is deliberately NOT mocked here, and that absence is itself
// an assertion. A transaction modal renders above RouterProvider, so the moment
// this control reaches for router context these renders start throwing — which
// is the bug where the savings modal never opened and the page just re-rendered.

const mocks = vi.hoisted(() => ({ walletChainId: 1, isSafeApp: false, bpi: 3 }));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => mocks.walletChainId,
  useChains: () => [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' },
    { id: 42161, name: 'Arbitrum One' }
  ]
}));
// `useAppChainId` is the wallet's chain even when wagmi has it pinned elsewhere
// (an unconfigured chain), which is what the escape-hatch test below relies on.
vi.mock('@/hooks', async () => ({
  // The real enum, so the tier comparison under test is the shipped one.
  BP: (await import('@/hooks/ui/useBreakpoint')).BP,
  useIsSafeApp: () => mocks.isSafeApp,
  useAppChainId: () => mocks.walletChainId,
  useBreakpointIndex: () => ({ bpi: mocks.bpi })
}));

const mockHandleSwitchChain = vi.fn();
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ handleSwitchChain: mockHandleSwitchChain })
}));

beforeEach(() => {
  mocks.walletChainId = 1;
  mocks.isSafeApp = false;
  mocks.bpi = BP.desktop;
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

  it('still switches to the shown chain when the wallet is off every product chain', () => {
    // Wallet parked on a chain the product (and the app) doesn't know. The pill
    // shows the product's first chain, but nothing is SELECTED — so picking
    // that same chain still asks the wallet. This is the way out after a
    // declined automatic switch; with the pinned chain selected Radix would
    // swallow the pick as a no-op.
    mocks.walletChainId = 137;
    render(<NetworkSelect chainIds={[1, 8453]} dataTestId="net" />);

    const trigger = screen.getByTestId('net');
    expect(trigger.textContent).toContain('Ethereum');

    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(screen.getByText('Ethereum', { selector: '[role="option"] *' }));

    expect(mockHandleSwitchChain).toHaveBeenCalledWith(expect.objectContaining({ chainId: 1 }));
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

  it('goes static inside the Safe iframe — its chain is fixed by the Safe app', () => {
    mocks.isSafeApp = true;

    render(<NetworkSelect chainIds={[1, 8453]} dataTestId="net" />);

    expect(screen.getByTestId('net').tagName).toBe('SPAN');
  });
});

// The phone-tier stand-in for a static control (1295:20810): the chain named
// as a title-suffix badge, not a control-shaped pill with nothing to switch.
describe('NetworkBadge + useIsNetworkSelectStatic', () => {
  it('is static for one chain or the Safe iframe, interactive otherwise', () => {
    expect(renderHook(() => useIsNetworkSelectStatic([1])).result.current).toBe(true);
    expect(renderHook(() => useIsNetworkSelectStatic([1, 8453])).result.current).toBe(false);
    mocks.isSafeApp = true;
    expect(renderHook(() => useIsNetworkSelectStatic([1, 8453])).result.current).toBe(true);
  });

  it('names the product’s chain as a plain badge, never the wallet’s', () => {
    mocks.walletChainId = 42161;
    render(<NetworkBadge chainIds={[1]} dataTestId="badge" />);

    const badge = screen.getByTestId('badge');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.textContent).toContain('Ethereum');
    expect(badge.querySelector('svg')).toBeTruthy();
    expect(badge.querySelector('.lucide-chevron-down')).toBeNull();
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

// The tier half of the same rule, now that both header builders ask for it
// here rather than each pairing the breakpoint with `useIsNetworkSelectStatic`.
describe('useNetworkTitleBadge', () => {
  it('stands in for the control only on a phone with nothing to switch', () => {
    mocks.bpi = BP.sm;
    expect(renderHook(() => useNetworkTitleBadge([1])).result.current).not.toBeNull();
    // Several chains: a real dropdown belongs there instead.
    expect(renderHook(() => useNetworkTitleBadge([1, 8453])).result.current).toBeNull();
    // No network control asked for at all.
    expect(renderHook(() => useNetworkTitleBadge(undefined)).result.current).toBeNull();

    mocks.bpi = BP.desktop;
    expect(renderHook(() => useNetworkTitleBadge([1])).result.current).toBeNull();
  });
});
