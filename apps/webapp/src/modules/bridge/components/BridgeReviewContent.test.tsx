/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { BridgeReviewContent } from './BridgeReviewContent';

// Token icons read the wallet's chain; the notes don't need them.
vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => undefined }));

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

  it("tells a Safe to execute every step from its queue, and that a stopped bridge can't be continued here", () => {
    review();
    expect(screen.queryByTestId('bridge-modal-safe-queue')).toBeNull();
    review({ safeQueue: true });
    const note = screen.getByTestId('bridge-modal-safe-queue').textContent;
    expect(note).toMatch(/execute every one of them in your Safe's queue/);
    expect(note).toMatch(/can't continue the bridge/);
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
