/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge, markBundleUnseen } from '../model/pendingTransitions';
import { cctpWithdrawalRoute, nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { PendingBridges } from './PendingBridges';

// The card of a wallet bundle with no hash may hide a burn that mined: it is
// dropped only after its L2 was read and showed none, and it says what to check.

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const MINUTE = 60_000;
const NOW = Date.now();

const burnBundle = (sentAgo: number) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: cctpWithdrawalRoute('base'),
    bundleId: 'bundle-burn',
    callsId: '0xcalls',
    now: NOW - sentAgo
  });
const depositBundle = (sentAgo: number) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'ethereum',
    to: 'base',
    route: nativeDepositRoute('base'),
    bundleId: 'bundle-deposit',
    callsId: '0xcalls',
    now: NOW - sentAgo
  });

// The store keeps a scope's cards in memory, so each test reads its own.
const mocks = vi.hoisted(() => ({ bridges: [] as PendingBridge[], now: 0, scope: 'bundle-not-found-0' }));

vi.mock('wagmi', () => ({ useEnsName: () => ({ data: undefined }) }));
vi.mock('@/modules/ui/components/Avatar', () => ({ CustomAvatar: () => <span /> }));
vi.mock('@/modules/ui/context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() })
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => <span /> }));
vi.mock('../hooks/usePendingBridges', () => ({
  usePendingBridges: () => ({ bridges: mocks.bridges, now: mocks.now })
}));
vi.mock('../hooks/useIncomingCctpBridges', () => ({ useIncomingCctpBridges: () => [] }));
vi.mock('../hooks/usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, familyChainId: 1, scope: mocks.scope })
}));
vi.mock('../hooks/useCctpConvertOffer', () => ({
  useCctpConvertOffer: () => ({ offer: undefined, nothingLeft: false })
}));
vi.mock('../hooks/useWithdrawalEthShortfall', () => ({ useWithdrawalEthShortfall: () => undefined }));
vi.mock('../hooks/useCctpResumeForm', () => ({ useCctpResumeForm: () => ({ blockedReason: undefined }) }));
vi.mock('../store/storageWritable', () => ({ isStorageWritable: () => true }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ activeSessionId: null })
}));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const props = {
  onAction: vi.fn(),
  onActionIn: vi.fn(),
  onContinue: vi.fn(),
  onConvert: vi.fn(),
  canAction: () => true,
  actionHint: () => undefined,
  actionLocked: false
};

let scopes = 0;

const show = (bridge: PendingBridge) => {
  pendingBridgeStore.upsert(mocks.scope, bridge);
  mocks.bridges = [bridge];
  mocks.now = NOW;
  render(
    <I18nProvider i18n={i18n}>
      <PendingBridges {...props} />
    </I18nProvider>
  );
  return screen.getByTestId('pending-bridge-card');
};

describe('a wallet bundle whose transaction was never reported', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.scope = `bundle-not-found-${++scopes}`;
  });
  afterEach(cleanup);

  it('keeps a CCTP bundle whose L2 was not read, however long ago it was sent', () => {
    const card = show(burnBundle(5 * 60 * MINUTE));

    expect(screen.queryByTestId('pending-bridge-dismiss')).toBeNull();
    expect(screen.queryByTestId('pending-bridge-dismiss-hint')).toBeNull();
    expect(screen.getByTestId('pending-bridge-status').textContent).toBe('Pending');
    expect(card.textContent).toContain('Not found on Base yet');
  });

  it('offers Dismiss once a read of the L2 found no burn, and says what to check first', () => {
    show(markBundleUnseen(burnBundle(31 * MINUTE), NOW));

    expect(screen.getByTestId('pending-bridge-dismiss-hint').textContent).toBe(
      "We couldn't find this bridge on Base. Dismiss it only if your wallet shows it never went through."
    );
    // Not a failure: the burn may still mine.
    expect(screen.getByTestId('pending-bridge-status').textContent).toBe('Pending');

    fireEvent.click(screen.getByTestId('pending-bridge-dismiss'));
    expect(pendingBridgeStore.getSnapshot(mocks.scope)).toEqual([]);
  });

  it('takes Dismiss back when the last read of the L2 is old', () => {
    show(markBundleUnseen(burnBundle(80 * MINUTE), NOW - 46 * MINUTE));

    expect(screen.queryByTestId('pending-bridge-dismiss')).toBeNull();
    expect(screen.queryByTestId('pending-bridge-dismiss-hint')).toBeNull();
  });

  it('says what to check before dismissing a deposit bundle', () => {
    show(depositBundle(31 * MINUTE));

    expect(screen.getByTestId('pending-bridge-dismiss')).toBeTruthy();
    expect(screen.getByTestId('pending-bridge-dismiss-hint').textContent).toBe(
      "We couldn't find this bridge on Ethereum. Dismiss it only if your wallet shows it never went through."
    );
  });

  it.each([
    ['a CCTP bundle', burnBundle(29 * MINUTE)],
    ['a deposit bundle', depositBundle(29 * MINUTE)]
  ])('offers neither for %s that may still be mining', (_label, bridge) => {
    show(bridge);

    expect(screen.queryByTestId('pending-bridge-dismiss')).toBeNull();
    expect(screen.queryByTestId('pending-bridge-dismiss-hint')).toBeNull();
  });
});
