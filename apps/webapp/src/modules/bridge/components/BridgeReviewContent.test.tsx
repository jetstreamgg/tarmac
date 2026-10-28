/**
 * @vitest-environment happy-dom
 */
import type { ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cctpWithdrawalRoute, nativeWithdrawalRoute, resolveBridgeRoute } from '../model/resolveRoute';
import { BridgeReviewContent } from './BridgeReviewContent';
import { buildRouteOptionCard } from './bridgeRouteOptions';

// Token icons read the wallet's chain; the notes don't need them.
vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => undefined }));
// The real icon renders no text; this one names its token so a side's symbol can be read.
vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: ({ token }: { token: { symbol: string } }) => <span>{token.symbol}</span>
}));

// Render motion elements synchronously so the picker swap is deterministic.
vi.mock('motion/react', async io => {
  const actual = await io<typeof import('motion/react')>();
  const React = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout']);
  const strip = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)));
  const tag =
    (element: string) =>
    ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
      React.createElement(element, strip(rest), children);
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, element) => tag(element as string) })
  };
});

i18n.load('en', {});
i18n.activate('en');

const AMOUNT = 10n ** 18n;
const resolved = resolveBridgeRoute({
  from: 'base',
  to: 'ethereum',
  amount: AMOUNT,
  facts: { cctp: { isOpen: true }, native: { isOpen: true } }
});
if (resolved.status !== 'ok') throw new Error(resolved.reason);
const ROUTE = resolved.route;

const review = (props: Partial<Parameters<typeof BridgeReviewContent>[0]> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <BridgeReviewContent
        amount={AMOUNT}
        from="base"
        to="ethereum"
        route={ROUTE}
        networkFee="-"
        {...props}
      />
    </I18nProvider>
  );

describe('BridgeReviewContent notes for a CCTP claim', () => {
  afterEach(cleanup);

  it('shows neither note by default', () => {
    review();
    expect(screen.queryByTestId('bridge-modal-recipient-warning')).toBeNull();
    expect(screen.queryByTestId('bridge-modal-contract-wallet')).toBeNull();
  });

  it('warns that another recipient has to be told and claims from a wallet they control', () => {
    review({ recipientWarning: true });
    const note = screen.getByTestId('bridge-modal-recipient-warning').textContent;
    expect(note).toMatch(/won't see this transfer automatically/);
    expect(note).toMatch(/claim link or the transaction hash/);
    expect(note).toMatch(/exchange deposit address won't work/);
  });

  // Figma 70: an amber box titled "Sending to another wallet".
  it('titles the recipient warning as a warning box', () => {
    review({ recipientWarning: true });
    const box = screen.getByTestId('bridge-modal-recipient-warning');
    expect(screen.getByTestId('bridge-modal-recipient-warning-title').textContent).toBe(
      'Sending to another wallet'
    );
    expect(box.className).toMatch(/bg-statusWarningBg/);
  });

  // Figma 91: a continued swap sends USDC and delivers USDS.
  it('shows USDC on the sending side when the bridge sends USDC', () => {
    review({ fromToken: 'USDC' });
    expect(screen.getByTestId('bridge-modal-from-amount').parentElement!.textContent).toBe('USDC1.00');
    expect(screen.getByTestId('bridge-modal-to-amount').parentElement!.textContent).toBe('USDS1.00');
  });

  it('shows USDS on both sides by default', () => {
    review();
    expect(screen.getByTestId('bridge-modal-from-amount').parentElement!.textContent).toBe('USDS1.00');
  });

  it("tells a Safe to execute every step from its queue, and that a stopped bridge can't be continued here", () => {
    review();
    expect(screen.queryByTestId('bridge-modal-safe-queue')).toBeNull();
    review({ safeQueue: true });
    const note = screen.getByTestId('bridge-modal-safe-queue').textContent;
    expect(note).toMatch(/execute every one of them in your Safe's queue/);
    expect(note).toMatch(/can't continue the bridge/);
  });

  it("tells a bridge this browser can't save to keep its claim link, only when asked", () => {
    review();
    expect(screen.queryByTestId('bridge-modal-storage-note')).toBeNull();
    review({ storageNote: true });
    const note = screen.getByTestId('bridge-modal-storage-note').textContent;
    expect(note).toBe(
      "Your browser can't save this bridge. Copy the claim link after sending, or you'll need the transaction hash to find it later."
    );
  });

  it('asks a contract wallet to confirm it controls its address on Ethereum', () => {
    const onAcceptedChange = vi.fn();
    review({ contractWallet: { accepted: false, onAcceptedChange } });
    const box = screen.getByTestId('bridge-modal-contract-wallet');
    expect(box.textContent).toMatch(/smart contract wallet/);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
    // The label ticks it too.
    fireEvent.click(screen.getByText(/I control this address on Ethereum/));
    expect(onAcceptedChange).toHaveBeenLastCalledWith(true);
  });

  it('shows the box ticked once accepted, and unticks it', () => {
    const onAcceptedChange = vi.fn();
    review({ contractWallet: { accepted: true, onAcceptedChange } });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(checkbox);
    expect(onAcceptedChange).toHaveBeenLastCalledWith(false);
  });
});

describe('BridgeReviewContent sender and recipient', () => {
  afterEach(cleanup);

  const SENDER = '0xA3F0000000000000000000000000000000009d2a';
  const RECIPIENT = '0x71C00000000000000000000000000000000008b5';

  it('shows no addresses for a bridge to the same wallet', () => {
    review();
    expect(screen.queryByText(/0x/)).toBeNull();
  });

  it('shows the sender under the source amount and the recipient under the destination amount', () => {
    review({ addresses: { from: SENDER, to: RECIPIENT } });
    expect(screen.getByText('0xA3F...d2a')).toBeTruthy();
    expect(screen.getByText('0x71C...8b5')).toBeTruthy();
  });
});

describe('BridgeReviewContent route picker', () => {
  afterEach(cleanup);

  const cctp = buildRouteOptionCard({
    option: { route: cctpWithdrawalRoute('base') },
    networkFee: '$0.02',
    approvals: 4
  });
  const native = buildRouteOptionCard({
    option: { route: nativeWithdrawalRoute('base') },
    networkFee: '~$3.10',
    approvals: 4
  });
  const greyedCctp = buildRouteOptionCard({
    option: { route: cctpWithdrawalRoute('base'), unavailable: 'no-liquidity' },
    networkFee: '-',
    approvals: undefined
  });

  it('offers no picker on a pair with a single route', () => {
    review();
    expect(screen.queryByTestId('bridge-modal-route-toggle')).toBeNull();
  });

  it('opens the options from the Bridge type row and closes them on back, keeping the route', () => {
    const onPick = vi.fn();
    review({ routePicker: { cards: [cctp, native], onPick } });
    fireEvent.click(screen.getByTestId('bridge-modal-route-toggle'));
    expect(screen.getByText('Select bridge type')).toBeTruthy();
    expect(screen.queryByTestId('bridge-modal-footnote')).toBeNull();
    const selected = screen.getByTestId('bridge-route-option-cctp');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.textContent).toContain('Fastest');
    expect(screen.getByTestId('bridge-route-option-native').textContent).toContain('~$3.10');
    fireEvent.click(screen.getByTestId('bridge-route-picker-back'));
    expect(screen.getByTestId('bridge-modal-footnote')).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('picks another route and goes back to the review', () => {
    const onPick = vi.fn();
    review({ routePicker: { cards: [cctp, native], onPick } });
    fireEvent.click(screen.getByTestId('bridge-modal-route-toggle'));
    fireEvent.click(screen.getByTestId('bridge-route-option-native'));
    expect(onPick).toHaveBeenCalledWith('native');
    expect(screen.getByTestId('bridge-modal-footnote')).toBeTruthy();
  });

  it("can't pick an unavailable route, and says why", () => {
    const onPick = vi.fn();
    review({
      route: nativeWithdrawalRoute('base', 'no-liquidity'),
      routePicker: { cards: [greyedCctp, native], onPick }
    });
    fireEvent.click(screen.getByTestId('bridge-modal-route-toggle'));
    const option = screen.getByTestId('bridge-route-option-cctp') as HTMLButtonElement;
    expect(option.disabled).toBe(true);
    expect(option.textContent).toContain('Insufficient liquidity');
    expect(screen.getByTestId('bridge-route-option-native').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(option);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('BridgeReviewContent route picker beside the review (Figma 3964:74437)', () => {
  afterEach(cleanup);

  const cctp = buildRouteOptionCard({
    option: { route: cctpWithdrawalRoute('base') },
    networkFee: '$0.02',
    approvals: 2
  });
  const native = buildRouteOptionCard({
    option: { route: nativeWithdrawalRoute('base') },
    networkFee: '~$3.10',
    approvals: 3
  });
  const greyedNative = buildRouteOptionCard({
    option: { route: nativeWithdrawalRoute('base'), unavailable: 'no-liquidity' },
    networkFee: '-',
    approvals: undefined
  });
  const eta = () => screen.getByTestId('bridge-modal-eta');

  it('strikes the slower route out of the arrival and badges the faster one', () => {
    review({ route: cctpWithdrawalRoute('base'), routePicker: { cards: [cctp, native], onPick: vi.fn() } });
    const struck = eta().querySelector('s');
    expect(struck?.textContent).toBe('~5 days');
    expect(screen.getByTestId('bridge-modal-eta-fast').textContent).toBe('~20 min');
    expect(screen.getByTestId('bridge-modal-eta-fast').querySelector('svg')).not.toBeNull();
  });

  it('shows the arrival alone when the picked route is the slower one', () => {
    review({ route: nativeWithdrawalRoute('base'), routePicker: { cards: [cctp, native], onPick: vi.fn() } });
    expect(screen.queryByTestId('bridge-modal-eta')).toBeNull();
    expect(screen.getByTestId('bridge-modal-footnote').closest('div')?.textContent).toContain('~5 days');
  });

  it("doesn't compare against a route that can't be picked", () => {
    review({
      route: cctpWithdrawalRoute('base'),
      routePicker: { cards: [cctp, greyedNative], onPick: vi.fn() }
    });
    expect(screen.queryByTestId('bridge-modal-eta')).toBeNull();
  });

  it('opens the options beside the review, which stays, when the caller draws them', () => {
    const onOpenChange = vi.fn();
    review({
      route: cctpWithdrawalRoute('base'),
      routePicker: { cards: [cctp, native], onPick: vi.fn(), beside: { open: false, onOpenChange } }
    });
    fireEvent.click(screen.getByTestId('bridge-modal-route-toggle'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('bridge-route-picker')).toBeNull();
    expect(screen.getByTestId('bridge-modal-footnote')).toBeTruthy();
  });

  it('closes the options beside from the same toggle', () => {
    const onOpenChange = vi.fn();
    review({
      route: cctpWithdrawalRoute('base'),
      routePicker: { cards: [cctp, native], onPick: vi.fn(), beside: { open: true, onOpenChange } }
    });
    fireEvent.click(screen.getByTestId('bridge-modal-route-toggle'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('dresses only the Fastest badge in the brand tint with a bolt', () => {
    review({ route: cctpWithdrawalRoute('base'), routePicker: { cards: [cctp, native], onPick: vi.fn() } });
    fireEvent.click(screen.getByTestId('bridge-modal-route-toggle'));
    const fastest = screen.getByText('Fastest').closest('[data-testid="bridge-route-badge"]')!;
    expect(fastest.className).toContain('bg-statusBrandBg');
    expect(fastest.querySelector('svg')).not.toBeNull();
    const nativeBadge = screen.getByText('Native').closest('[data-testid="bridge-route-badge"]')!;
    expect(nativeBadge.querySelector('svg')).toBeNull();
  });
});
