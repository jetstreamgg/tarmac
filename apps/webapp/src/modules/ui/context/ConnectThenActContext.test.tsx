import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

const h = vi.hoisted(() => ({ connected: true, acceptedTerms: true, connecting: false }));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => ({
      address: h.connected ? TEST_ADDRESS : undefined,
      isConnected: h.connected,
      isConnecting: h.connecting
    }),
    // The providers' analytics hooks read the chain list; the real hook needs
    // a WagmiProvider this harness doesn't mount.
    useChains: () => [{ id: 1, name: 'Ethereum' }]
  };
});

vi.mock('./ConnectedContext', async importOriginal => {
  const actual = await importOriginal<typeof import('./ConnectedContext')>();
  return {
    ...actual,
    useConnectedContext: () => ({
      isConnectedAndAcceptedTerms: h.connected && h.acceptedTerms
    })
  };
});

// The real ConnectModal pulls in the full wallet-connector stack; the intent
// lifecycle only cares about the modal opening and closing, so stub it with
// its open/close contract intact.
vi.mock('../components/ConnectModal', () => ({
  ConnectModal: ({ onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="connect-modal-stub">
      <button data-testid="connect-modal-dismiss" onClick={() => onOpenChange(false)} />
    </div>
  )
}));

import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import type { ConnectReason } from '@/modules/analytics/constants';
import { capturedEventsNamed, clearCapturedEvents, lastCapturedEvent } from '@/test/analyticsCapture';
import { ConnectModalProvider } from './ConnectModalContext';
import { ConnectThenActProvider, useConnectThenAct, CONTINUATION_DELAY_MS } from './ConnectThenActContext';

function Probe({
  action,
  label = 'cta',
  reason
}: {
  action: () => void;
  label?: string;
  reason?: ConnectReason;
}) {
  const run = useConnectThenAct(action, reason);
  return <button data-testid={label} onClick={run} />;
}

const wrap = (ui: React.ReactNode) => (
  <AnalyticsFlowProvider>
    <ConnectModalProvider>
      <ConnectThenActProvider>{ui}</ConnectThenActProvider>
    </ConnectModalProvider>
  </AnalyticsFlowProvider>
);

describe('useConnectThenAct', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    h.connected = true;
    h.acceptedTerms = true;
    h.connecting = false;
  });

  it('runs the action immediately when already connected and past the terms gate', () => {
    const action = vi.fn();
    render(wrap(<Probe action={action} />));

    fireEvent.click(screen.getByTestId('cta'));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('connect-modal-stub')).toBeNull();
  });

  it('opens the connect modal instead of running the action while disconnected', () => {
    h.connected = false;
    h.acceptedTerms = false;
    const action = vi.fn();
    render(wrap(<Probe action={action} />));

    fireEvent.click(screen.getByTestId('cta'));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId('connect-modal-stub')).toBeTruthy();
  });

  it('runs the pending action exactly once, a beat after the ready state, so modals do not flash', () => {
    vi.useFakeTimers();
    h.connected = false;
    h.acceptedTerms = false;
    const action = vi.fn();
    const view = render(wrap(<Probe action={action} />));

    fireEvent.click(screen.getByTestId('cta'));
    expect(action).not.toHaveBeenCalled();

    // Wallet connects and the terms gate passes (isConnectedAndAcceptedTerms flips).
    h.connected = true;
    h.acceptedTerms = true;
    view.rerender(wrap(<Probe action={action} />));

    // Not immediately: the connect modal's close animation gets a beat to finish.
    expect(action).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS - 1));
    expect(action).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(action).toHaveBeenCalledTimes(1);

    // Further renders and timers must not re-fire the consumed intent.
    view.rerender(wrap(<Probe action={action} />));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS * 2));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('discards the intent when the connect modal is dismissed without connecting', () => {
    vi.useFakeTimers();
    h.connected = false;
    h.acceptedTerms = false;
    const action = vi.fn();
    const view = render(wrap(<Probe action={action} />));

    fireEvent.click(screen.getByTestId('cta'));
    fireEvent.click(screen.getByTestId('connect-modal-dismiss'));

    // A later connect (e.g. via the header) must not surface the stale action.
    h.connected = true;
    h.acceptedTerms = true;
    view.rerender(wrap(<Probe action={action} />));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS * 2));

    expect(action).not.toHaveBeenCalled();
  });

  it('keeps the intent when the modal is dismissed while a connection attempt is still in flight', () => {
    vi.useFakeTimers();
    h.connected = false;
    h.acceptedTerms = false;
    const action = vi.fn();
    const view = render(wrap(<Probe action={action} />));

    fireEvent.click(screen.getByTestId('cta'));

    // User picked a wallet (request pending in the extension), then closed our
    // dialog. The attempt is still in flight — the intent must survive it.
    h.connecting = true;
    view.rerender(wrap(<Probe action={action} />));
    fireEvent.click(screen.getByTestId('connect-modal-dismiss'));

    h.connecting = false;
    h.connected = true;
    h.acceptedTerms = true;
    view.rerender(wrap(<Probe action={action} />));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('keeps only the most recent intent when several CTAs are clicked while disconnected', () => {
    vi.useFakeTimers();
    h.connected = false;
    h.acceptedTerms = false;
    const supplyA = vi.fn();
    const supplyB = vi.fn();
    const probes = (
      <>
        <Probe action={supplyA} label="cta-a" />
        <Probe action={supplyB} label="cta-b" />
      </>
    );
    const view = render(wrap(probes));

    fireEvent.click(screen.getByTestId('cta-a'));
    fireEvent.click(screen.getByTestId('cta-b'));

    h.connected = true;
    h.acceptedTerms = true;
    view.rerender(wrap(probes));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));

    expect(supplyA).not.toHaveBeenCalled();
    expect(supplyB).toHaveBeenCalledTimes(1);
  });
});

describe('gated-action analytics (APP-444 C4/C5)', () => {
  beforeEach(() => clearCapturedEvents());

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    h.connected = true;
    h.acceptedTerms = true;
    h.connecting = false;
  });

  it('names the gated reason on the connect-modal-opened event', () => {
    h.connected = false;
    h.acceptedTerms = false;
    render(wrap(<Probe action={vi.fn()} reason="savings_supply" />));

    fireEvent.click(screen.getByTestId('cta'));

    expect(lastCapturedEvent('app_connect_modal_opened')?.properties).toMatchObject({
      connect_reason: 'savings_supply'
    });
  });

  it('resolves completed with the reason once the resumed action runs', () => {
    vi.useFakeTimers();
    h.connected = false;
    h.acceptedTerms = false;
    const action = vi.fn();
    const view = render(wrap(<Probe action={action} reason="convert" />));

    fireEvent.click(screen.getByTestId('cta'));
    expect(capturedEventsNamed('app_gated_action_resolved')).toHaveLength(0);

    h.connected = true;
    h.acceptedTerms = true;
    view.rerender(wrap(<Probe action={action} reason="convert" />));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));

    expect(action).toHaveBeenCalledTimes(1);
    const resolved = lastCapturedEvent('app_gated_action_resolved');
    expect(resolved?.properties).toMatchObject({ outcome: 'completed', connect_reason: 'convert' });
    expect(resolved?.properties.flow_id).toBeTruthy();
  });

  it('resolves abandoned exactly once when the modal is dismissed without connecting', () => {
    vi.useFakeTimers();
    h.connected = false;
    h.acceptedTerms = false;
    const action = vi.fn();
    const view = render(wrap(<Probe action={action} reason="stake_open" />));

    fireEvent.click(screen.getByTestId('cta'));
    fireEvent.click(screen.getByTestId('connect-modal-dismiss'));

    expect(lastCapturedEvent('app_gated_action_resolved')?.properties).toMatchObject({
      outcome: 'abandoned',
      connect_reason: 'stake_open'
    });

    // The consumed intent must not resolve again on later state churn.
    h.connected = true;
    h.acceptedTerms = true;
    view.rerender(wrap(<Probe action={action} reason="stake_open" />));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS * 2));
    expect(capturedEventsNamed('app_gated_action_resolved')).toHaveLength(1);
    expect(action).not.toHaveBeenCalled();
  });
});
