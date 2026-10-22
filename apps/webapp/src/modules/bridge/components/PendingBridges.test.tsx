/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CctpResumeBlockReason } from '../hooks/useCctpResumeForm';
import type { DestinationActionHint } from '../hooks/useDestinationActionLaunch';
import type { IncomingBridge } from '../hooks/useIncomingCctpBridges';
import type { PendingBridge } from '../model/types';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { PendingBridges } from './PendingBridges';

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const BRIDGE: PendingBridge = {
  id: '0xabc',
  account: ACCOUNT,
  amount: 10_000n * 10n ** 18n,
  token: 'USDS',
  from: 'ethereum',
  to: 'base',
  status: 'pending',
  routeKind: 'native',
  requiresClaim: false,
  startedAt: 0,
  etaAt: 3 * 60_000,
  txHash: '0xff90000000000000000000000000000000000000000000000000000000000a6',
  actions: []
};

const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x5a00000000000000000000000000000000000000000000000000000000000b7c',
  network: 'optimism',
  usdcAmount: 250n * 10n ** 6n,
  recipient: ACCOUNT,
  at: 0
};
const OLDER_SWAP: UnfinishedCctpSwap = {
  ...SWAP,
  swapTxHash: '0x6b',
  network: 'base',
  usdcAmount: 7n * 10n ** 6n
};

const CLAIMED: PendingBridge = {
  ...BRIDGE,
  id: '0xcctp',
  from: 'base',
  to: 'ethereum',
  status: 'claimed',
  routeKind: 'cctp',
  requiresClaim: true,
  settledAt: 0,
  actions: [{ action: 'claim', txHash: '0xc1a1', at: 0 }]
};
const OFFER = 40n * 10n ** 6n;

const mocks = vi.hoisted(() => ({
  bridges: [] as PendingBridge[],
  incoming: [] as IncomingBridge[],
  offers: {} as Record<string, bigint | undefined>,
  blocked: {} as Record<string, CctpResumeBlockReason | undefined>,
  activeSessionId: null as string | null,
  copy: vi.fn(),
  copyFails: false,
  storageWritable: true,
  toast: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));

// Renders no text; names its token so a card's icon can be read.
vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: ({ token }: { token: { symbol: string } }) => (
    <span data-testid="token-icon" data-symbol={token.symbol} />
  )
}));
vi.mock('../hooks/usePendingBridges', () => ({
  usePendingBridges: () => ({ bridges: mocks.bridges, now: 0 })
}));
vi.mock('../hooks/useIncomingCctpBridges', () => ({
  useIncomingCctpBridges: () => mocks.incoming
}));
vi.mock('../hooks/usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, familyChainId: 1, scope: 'scope' })
}));

vi.mock('../hooks/useCctpConvertOffer', () => ({
  useCctpConvertOffer: (bridge: PendingBridge) => mocks.offers[bridge.id]
}));
vi.mock('../hooks/useCctpResumeForm', () => ({
  useCctpResumeForm: (swap: UnfinishedCctpSwap) => ({ blockedReason: mocks.blocked[swap.swapTxHash] })
}));
vi.mock('@/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils')>()),
  copyToClipboard: (text: string, onSuccess?: () => void, onError?: (error: Error) => void) => {
    mocks.copy(text);
    if (mocks.copyFails) onError?.(new Error('denied'));
    else onSuccess?.();
  }
}));
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => mocks.storageWritable }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ activeSessionId: mocks.activeSessionId })
}));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const props = {
  onAction: vi.fn(),
  onActionIn: vi.fn(),
  onContinue: vi.fn(),
  canAction: vi.fn<(bridge: PendingBridge, action?: string) => boolean>(() => true),
  actionHint: vi.fn<(bridge: PendingBridge, action?: 'convert') => DestinationActionHint | undefined>(
    () => undefined
  ),
  actionLocked: false
};

const renderList = (change: Partial<typeof props> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <PendingBridges {...props} {...change} />
    </I18nProvider>
  );

describe('PendingBridges', () => {
  beforeEach(() => {
    Object.assign(mocks, {
      bridges: [],
      incoming: [],
      offers: {},
      blocked: {},
      activeSessionId: null,
      copyFails: false,
      storageWritable: true
    });
    mocks.copy.mockClear();
    mocks.toast.success.mockClear();
    props.onAction.mockClear();
    props.onActionIn.mockClear();
    props.canAction.mockReset().mockReturnValue(true);
    props.actionHint.mockReset().mockReturnValue(undefined);
    props.onContinue.mockClear();
    localStorage.clear();
    [SWAP, OLDER_SWAP].forEach(swap => cctpSwapStore.clear('scope', swap.swapTxHash));
  });
  afterEach(cleanup);

  it('renders nothing with no pending bridges', () => {
    expect(renderList().container.innerHTML).toBe('');
  });

  it('lists each pending bridge with its amount, rows and status', () => {
    mocks.bridges = [BRIDGE, { ...BRIDGE, id: '0xdef', to: 'arbitrum' }];
    renderList();
    expect(screen.getByRole('heading').textContent).toBe('Pending bridges');
    const cards = screen.getAllByTestId('pending-bridge-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain('10,000.00');
    expect(cards[0]?.textContent).toContain('Base');
    expect(cards[1]?.textContent).toContain('Arbitrum One');
    expect(screen.getAllByTestId('pending-bridge-status')[0]?.textContent).toBe('Pending');
  });

  it("sends a card's next action", () => {
    mocks.bridges = [{ ...BRIDGE, status: 'ready', nextAction: 'claim', requiresClaim: true }];
    renderList();
    fireEvent.click(screen.getByTestId('pending-bridge-action'));
    expect(props.onAction).toHaveBeenCalledWith(mocks.bridges[0]);
  });

  describe('a CCTP claim minting to another address', () => {
    const RECIPIENT = '0x00000000000000000000000000000000000b0b01';
    const TO_OTHER: PendingBridge = {
      ...BRIDGE,
      id: '0xother',
      from: 'base',
      to: 'ethereum',
      status: 'ready',
      routeKind: 'cctp',
      requiresClaim: true,
      nextAction: 'claim',
      recipient: RECIPIENT
    };
    const note = () => screen.queryByTestId('pending-bridge-recipient-note');

    it('shows the status and says the destination wallet claims it, with no Claim button', () => {
      mocks.bridges = [TO_OTHER];
      renderList();
      expect(screen.getByTestId('pending-bridge-status').textContent).toBe('Ready to claim');
      expect(screen.queryByTestId('pending-bridge-action')).toBeNull();
      expect(note()?.textContent).toBe(
        'Only the destination wallet (0x0000...0b01) can claim it on Ethereum.'
      );
    });

    it('says so while the transfer is still on its way', () => {
      mocks.bridges = [{ ...TO_OTHER, status: 'pending' }];
      renderList();
      expect(screen.getByTestId('pending-bridge-status').textContent).toBe('Pending');
      expect(note()).not.toBeNull();
    });

    it('drops the note once the bridge settles', () => {
      mocks.bridges = [{ ...TO_OTHER, status: 'arrived', nextAction: undefined, settledAt: 0 }];
      renderList();
      expect(note()).toBeNull();
    });

    it('hides a hint for a claim this wallet cannot send', () => {
      props.actionHint.mockReturnValue({ kind: 'switch-network', network: 'ethereum', safe: false });
      mocks.bridges = [TO_OTHER];
      renderList();
      expect(screen.queryByTestId('pending-bridge-action-hint')).toBeNull();
    });

    it('keeps the Claim button for the recipient and for a bridge to the sender', () => {
      mocks.bridges = [
        { ...TO_OTHER, id: '0xmine', recipient: ACCOUNT.toUpperCase().replace('0X', '0x') },
        { ...TO_OTHER, id: '0xnone', recipient: undefined }
      ];
      renderList();
      expect(screen.getAllByTestId('pending-bridge-action')).toHaveLength(2);
      expect(note()).toBeNull();
    });
  });

  describe("a CCTP bridge sent to this wallet from another account's list", () => {
    const SENDER = '0x00000000000000000000000000000000005e7d01';
    const SENDER_SCOPE = `1:${SENDER}`;
    const INCOMING: PendingBridge = {
      ...BRIDGE,
      id: '0xincoming',
      account: SENDER,
      recipient: ACCOUNT,
      from: 'base',
      to: 'ethereum',
      status: 'ready',
      routeKind: 'cctp',
      requiresClaim: true,
      nextAction: 'claim',
      startedAt: 5
    };
    const incoming = (...bridges: PendingBridge[]) =>
      (mocks.incoming = bridges.map(bridge => ({ scope: SENDER_SCOPE, bridge })));

    it('lists it with no bridge of its own, saying who sent it', () => {
      incoming(INCOMING);
      renderList();
      expect(screen.getAllByTestId('pending-bridge-card')).toHaveLength(1);
      expect(screen.getByTestId('pending-bridge-incoming-note').textContent).toBe(
        'Sent to this wallet from 0x0000...7d01.'
      );
      expect(screen.queryByTestId('pending-bridge-recipient-note')).toBeNull();
    });

    it("claims it in the sender's list", () => {
      incoming(INCOMING);
      renderList();
      fireEvent.click(screen.getByTestId('pending-bridge-action'));
      expect(props.onActionIn).toHaveBeenCalledWith(SENDER_SCOPE, INCOMING, undefined, undefined);
      expect(props.onAction).not.toHaveBeenCalled();
    });

    it("converts the USDC its claim left in the sender's list", () => {
      const claimed = { ...CLAIMED, id: '0xincoming', account: SENDER, recipient: ACCOUNT };
      incoming(claimed);
      mocks.offers[claimed.id] = OFFER;
      renderList();
      fireEvent.click(screen.getByTestId('pending-bridge-convert'));
      expect(props.onActionIn).toHaveBeenCalledWith(SENDER_SCOPE, claimed, 'convert', OFFER);
    });

    it("lists it among the wallet's own bridges, newest first", () => {
      mocks.bridges = [
        { ...BRIDGE, startedAt: 9 },
        { ...BRIDGE, id: '0xold', startedAt: 1 }
      ];
      incoming(INCOMING);
      renderList();
      expect(screen.getAllByTestId('pending-bridge-incoming-note')).toHaveLength(1);
      const cards = screen.getAllByTestId('pending-bridge-card');
      expect(cards.map(card => !!card.querySelector('[data-testid="pending-bridge-incoming-note"]'))).toEqual(
        [false, true, false]
      );
    });

    it("offers no Dismiss: the entry is the sender's", () => {
      incoming({
        ...INCOMING,
        status: 'pending',
        nextAction: undefined,
        txHash: undefined,
        safeTxHash: '0x5afe'
      });
      renderList();
      expect(screen.getByTestId('pending-bridge-card')).toBeTruthy();
      expect(screen.queryByTestId('pending-bridge-dismiss')).toBeNull();
    });

    it('leaves once settled for more than a day', () => {
      incoming({
        ...INCOMING,
        status: 'claimed',
        nextAction: undefined,
        settledAt: -2 * 24 * 60 * 60 * 1000
      });
      expect(renderList().container.innerHTML).toBe('');
    });
  });

  describe('converting a CCTP claim to USDS', () => {
    const convertButton = () => screen.getByTestId('pending-bridge-convert') as HTMLButtonElement;
    const convertHint = (hint: DestinationActionHint) =>
      props.actionHint.mockImplementation((_, action) => (action === 'convert' ? hint : undefined));

    it('offers it on a claim that kept its USDC, and says how much it converts', () => {
      mocks.bridges = [CLAIMED];
      mocks.offers[CLAIMED.id] = OFFER;
      renderList();
      expect(convertButton().textContent).toBe('Convert to USDS');
      expect(convertButton().disabled).toBe(false);
      expect(props.canAction).toHaveBeenCalledWith(CLAIMED, 'convert');
      // Never says the USDC is still in the wallet: some of it may have left since the claim.
      expect(screen.getByTestId('pending-bridge-convert-note').textContent).toBe(
        'This claim ended in USDC, not USDS. You can convert 40.00 USDC to USDS.'
      );
    });

    // Figma 93: a card whose claim ended in USDC shows the USDC icon.
    it('shows the USDC icon on a claim that kept its USDC, and USDS otherwise', () => {
      mocks.bridges = [CLAIMED];
      mocks.offers[CLAIMED.id] = OFFER;
      const { unmount } = renderList();
      expect(screen.getByTestId('token-icon').dataset.symbol).toBe('USDC');
      unmount();
      delete mocks.offers[CLAIMED.id];
      renderList();
      expect(screen.getByTestId('token-icon').dataset.symbol).toBe('USDS');
    });

    it('converts the amount offered', () => {
      mocks.bridges = [CLAIMED];
      mocks.offers[CLAIMED.id] = OFFER;
      renderList();
      fireEvent.click(convertButton());
      expect(props.onAction).toHaveBeenCalledExactlyOnceWith(CLAIMED, 'convert', OFFER);
    });

    it('offers nothing when there is nothing to convert', () => {
      mocks.bridges = [CLAIMED];
      renderList();
      expect(screen.queryByTestId('pending-bridge-convert')).toBeNull();
      expect(screen.queryByTestId('pending-bridge-convert-note')).toBeNull();
      expect(screen.queryByTestId('pending-bridge-action')).toBeNull();
    });

    it("can't convert while an action's session is minimized, or when it can't be sent", () => {
      mocks.bridges = [CLAIMED];
      mocks.offers[CLAIMED.id] = OFFER;
      renderList({ actionLocked: true });
      expect(convertButton().disabled).toBe(true);
      cleanup();

      props.canAction.mockImplementation((_, action) => action !== 'convert');
      renderList();
      expect(convertButton().disabled).toBe(true);
      fireEvent.click(convertButton());
      expect(props.onAction).not.toHaveBeenCalled();
    });

    it('says a sent conversion is confirming, once it is no longer offered', () => {
      mocks.bridges = [CLAIMED];
      convertHint({ kind: 'action-sent', network: 'ethereum' });
      renderList();
      expect(screen.queryByTestId('pending-bridge-convert')).toBeNull();
      expect(screen.getByTestId('pending-bridge-action-hint').textContent).toBe(
        'Waiting for the transaction to confirm on Ethereum.'
      );
    });

    it('asks for a network switch only while the conversion is offered', () => {
      mocks.bridges = [CLAIMED];
      convertHint({ kind: 'switch-network', network: 'ethereum', safe: false });
      renderList();
      expect(screen.queryByTestId('pending-bridge-action-hint')).toBeNull();
      cleanup();

      mocks.offers[CLAIMED.id] = OFFER;
      renderList();
      expect(screen.getByTestId('pending-bridge-action-hint').textContent).toBe(
        'Switch your wallet to Ethereum to continue.'
      );
    });

    it("a card's own action still comes first", () => {
      mocks.bridges = [{ ...BRIDGE, status: 'ready', nextAction: 'claim', requiresClaim: true }];
      mocks.offers[BRIDGE.id] = OFFER;
      props.actionHint.mockImplementation((_, action) =>
        action === 'convert' ? { kind: 'safe-executing' } : { kind: 'action-sent', network: 'base' }
      );
      renderList();
      expect(screen.getByTestId('pending-bridge-action').textContent).toBe('Claim');
      expect(screen.queryByTestId('pending-bridge-convert')).toBeNull();
      expect(screen.getByTestId('pending-bridge-action-hint').textContent).toBe(
        'Waiting for the transaction to confirm on Base.'
      );
    });
  });

  describe('the claim link of a CCTP bridge to Ethereum', () => {
    const BURN: PendingBridge = {
      ...BRIDGE,
      id: '0xburn',
      from: 'base',
      to: 'ethereum',
      routeKind: 'cctp',
      requiresClaim: true,
      nextAction: 'claim',
      txHash: `0x${'ab'.repeat(32)}`
    };
    const OTHER = '0x00000000000000000000000000000000000b0b01';
    const LINK = `${window.location.origin}/convert?tab=bridge&claim_network=base&claim_tx=${BURN.txHash}`;

    it('copies the link that opens its claim', () => {
      mocks.bridges = [BURN];
      renderList();
      const button = screen.getByTestId('pending-bridge-claim-link');
      expect(button.textContent).toBe('Copy claim link');
      fireEvent.click(button);
      expect(mocks.copy).toHaveBeenCalledWith(LINK);
    });

    // Figma 72: a toast says it, and the button keeps its label.
    it('toasts that it was copied', () => {
      mocks.bridges = [BURN];
      renderList();
      expect(mocks.toast.success).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('pending-bridge-claim-link'));
      expect(mocks.toast.success).toHaveBeenCalledTimes(1);
      expect(mocks.toast.success).toHaveBeenCalledWith('Claim link copied!');
      expect(screen.getByTestId('pending-bridge-claim-link').textContent).toBe('Copy claim link');
    });

    it('toasts nothing when the copy fails', () => {
      mocks.bridges = [BURN];
      mocks.copyFails = true;
      renderList();
      fireEvent.click(screen.getByTestId('pending-bridge-claim-link'));
      expect(mocks.copy).toHaveBeenCalledWith(LINK);
      expect(mocks.toast.success).not.toHaveBeenCalled();
    });

    // Figma 71: a full-width secondary button under the card's text.
    it('shows it as a full-width button after its note', () => {
      mocks.bridges = [{ ...BURN, recipient: OTHER }];
      renderList();
      const button = screen.getByTestId('pending-bridge-claim-link');
      expect(button.tagName).toBe('BUTTON');
      expect(button.className).toMatch(/\bw-full\b/);
      const note = screen.getByTestId('pending-bridge-claim-link-note');
      expect(note.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('offers it on a bridge sent to this wallet too', () => {
      mocks.incoming = [{ scope: 'sender', bridge: { ...BURN, account: OTHER, recipient: ACCOUNT } }];
      renderList();
      fireEvent.click(screen.getByTestId('pending-bridge-claim-link'));
      expect(mocks.copy).toHaveBeenCalledWith(LINK);
    });

    it('offers none on a native deposit or a claimed bridge', () => {
      mocks.bridges = [BRIDGE, { ...CLAIMED, nextAction: 'convert' }];
      renderList();
      expect(screen.queryByTestId('pending-bridge-claim-link')).toBeNull();
    });

    it('asks the sender to share it with the recipient', () => {
      mocks.bridges = [{ ...BURN, recipient: OTHER }];
      renderList();
      expect(screen.getByTestId('pending-bridge-claim-link-note').textContent).toBe(
        'Share the claim link with the recipient so they can claim it.'
      );
    });

    it('asks to keep it when this browser keeps no bridges', () => {
      mocks.storageWritable = false;
      mocks.bridges = [BURN];
      renderList();
      expect(screen.getByTestId('pending-bridge-claim-link-note').textContent).toBe(
        "This browser can't save your bridges. Copy the claim link and keep it to claim later."
      );
    });

    it('asks the sender to share it, not to keep it, when this browser keeps no bridges', () => {
      mocks.storageWritable = false;
      mocks.bridges = [{ ...BURN, recipient: OTHER }];
      renderList();
      expect(screen.getByTestId('pending-bridge-claim-link-note').textContent).toBe(
        'Share the claim link with the recipient so they can claim it.'
      );
    });

    it('adds no note for your own bridge in a browser that keeps it', () => {
      mocks.bridges = [BURN];
      renderList();
      expect(screen.queryByTestId('pending-bridge-claim-link-note')).toBeNull();
    });
  });

  describe('unfinished CCTP swaps', () => {
    const record = (...swaps: UnfinishedCctpSwap[]) =>
      [...swaps].reverse().forEach(swap => cctpSwapStore.record('scope', swap));
    const continueButton = () => screen.getByTestId('continue-bridge-action') as HTMLButtonElement;

    // Figma "Pending component bridge": one border-primary line, above the rows.
    it('draws its only divider above the rows, on every card', () => {
      mocks.bridges = [BRIDGE];
      record(SWAP);
      renderList();
      for (const card of [
        screen.getByTestId('pending-bridge-card'),
        screen.getByTestId('continue-bridge-card')
      ]) {
        const dividers = [...card.querySelectorAll('*')].filter(el => /\bborder-[bt]\b/.test(el.className));
        expect(dividers).toHaveLength(1);
        expect(dividers[0]?.getAttribute('data-testid')).toBe('pending-bridge-rows');
        expect(dividers[0]?.className).toMatch(/\bborder-t\b/);
        expect(dividers[0]?.className).toMatch(/\bborder-borderPrimary\b/);
      }
    });

    it('lists them with no pending bridge, newest first', () => {
      record(SWAP, OLDER_SWAP);
      renderList();
      expect(screen.getByRole('heading').textContent).toBe('Pending bridges');
      const cards = screen.getAllByTestId('continue-bridge-card');
      expect(cards).toHaveLength(2);
      expect(cards[0]?.textContent).toContain('250.00');
      expect(cards[0]?.textContent).toContain('OP Mainnet');
      expect(cards[0]?.textContent).toContain('Not sent');
      expect(cards[1]?.textContent).toContain('7.00');
      expect(screen.queryAllByTestId('pending-bridge-card')).toHaveLength(0);
    });

    it('says where the USDC is', () => {
      record(SWAP);
      renderList();
      expect(screen.getByTestId('continue-bridge-note').textContent).toBe(
        "Your USDS was swapped to USDC on OP Mainnet, but the USDC wasn't bridged. It's still in your wallet."
      );
    });

    it('lists them above the pending bridges, which still render as before', () => {
      record(SWAP);
      mocks.bridges = [BRIDGE];
      renderList();
      const cards = screen.getByTestId('pending-bridges').querySelectorAll('[data-testid$="-card"]');
      expect([...cards].map(card => card.getAttribute('data-testid'))).toEqual([
        'continue-bridge-card',
        'pending-bridge-card'
      ]);
      expect(screen.getByTestId('pending-bridge-card').textContent).toContain('10,000.00');
    });

    it('continues the swap of the card clicked', () => {
      record(SWAP, OLDER_SWAP);
      renderList();
      fireEvent.click(screen.getAllByTestId('continue-bridge-action')[1]!);
      expect(props.onContinue).toHaveBeenCalledExactlyOnceWith(OLDER_SWAP);
    });

    // A second bridge of the same USDC must not start while another transaction is open or minimized.
    it("can't continue while a transaction session is active", () => {
      record(SWAP);
      mocks.activeSessionId = 'session';
      renderList();
      expect(continueButton().disabled).toBe(true);
      fireEvent.click(continueButton());
      expect(props.onContinue).not.toHaveBeenCalled();
      expect(screen.getByTestId('continue-bridge-hint').textContent).toBe(
        'A transaction is in progress. Open it to continue.'
      );
    });

    it.each([
      ['source-unavailable', "Bridging from OP Mainnet isn't available yet."],
      ['wallet-unknown', "We couldn't check your wallet type. Try again in a moment."],
      ['balance-unknown', "We couldn't load your USDC balance. Try again in a moment."],
      ['insufficient', 'Your wallet has less USDC on OP Mainnet than this bridge needs.'],
      ['pair-not-allowed', "Bridging this USDC to Ethereum isn't available yet."],
      ['over-limit', 'This amount is over the bridge limit right now. Try again later.'],
      ['no-liquidity', 'Not enough liquidity on Ethereum for this amount right now. Try again later.'],
      ['facts-error', "We couldn't check this route. Try again in a moment."],
      ['closed', 'This route is temporarily unavailable.']
    ] as const)("can't continue when %s, and says why", (reason, message) => {
      record(SWAP);
      mocks.blocked[SWAP.swapTxHash] = reason;
      renderList();
      expect(continueButton().disabled).toBe(true);
      expect(screen.getByTestId('continue-bridge-blocked').textContent).toBe(message);
    });

    it.each(['facts-loading', 'balance-loading', 'wallet-checking'] as const)(
      "can't continue while %s, with no message",
      reason => {
        record(SWAP);
        mocks.blocked[SWAP.swapTxHash] = reason;
        renderList();
        expect(continueButton().disabled).toBe(true);
        expect(screen.queryByTestId('continue-bridge-blocked')).toBeNull();
      }
    );

    it('blocks only the card that is blocked', () => {
      record(SWAP, OLDER_SWAP);
      mocks.blocked[OLDER_SWAP.swapTxHash] = 'insufficient';
      renderList();
      const buttons = screen.getAllByTestId('continue-bridge-action') as HTMLButtonElement[];
      expect(buttons.map(button => button.disabled)).toEqual([false, true]);
    });

    it('forgets a dismissed swap', () => {
      record(SWAP, OLDER_SWAP);
      renderList();
      fireEvent.click(screen.getAllByTestId('continue-bridge-dismiss')[0]!);
      expect(cctpSwapStore.getSnapshot('scope')).toEqual([OLDER_SWAP]);
      expect(screen.getAllByTestId('continue-bridge-card')).toHaveLength(1);
    });
  });
});
