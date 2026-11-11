/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { afterUnknownSourcePoll } from '../tracking/sourceNotFound.fixtures';
import { PendingBridges } from './PendingBridges';

// The card of a bridge whose source transaction the chain has no record of
// tells the user what happened and what to check, and lets them drop it.

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const HASH = `0x${'c4'.repeat(32)}`;
const CCTP: PendingBridge = {
  id: HASH,
  account: ACCOUNT,
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: 0,
  etaAt: 20 * MINUTE,
  txHash: HASH,
  actions: []
};
const DEPOSIT: PendingBridge = {
  ...CCTP,
  from: 'ethereum',
  to: 'base',
  routeKind: 'native',
  requiresClaim: false,
  nextAction: undefined
};
const WITHDRAWAL: PendingBridge = { ...CCTP, routeKind: 'native', nextAction: 'prove' };

const mocks = vi.hoisted(() => ({ bridges: [] as PendingBridge[], now: 0 }));

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
  usePendingScope: () => ({ account: ACCOUNT, familyChainId: 1, scope: 'scope' })
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

const show = (bridge: PendingBridge, now: number) => {
  pendingBridgeStore.upsert('scope', bridge);
  mocks.bridges = [bridge];
  mocks.now = now;
  render(
    <I18nProvider i18n={i18n}>
      <PendingBridges {...props} />
    </I18nProvider>
  );
  return screen.getByTestId('pending-bridge-card');
};

describe('a pending bridge whose source transaction the chain has no record of', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it.each([
    ['a CCTP bridge', CCTP, 15 * MINUTE, 'Base'],
    ['a deposit', DEPOSIT, 3 * HOUR, 'Ethereum'],
    ['a withdrawal', WITHDRAWAL, 15 * MINUTE, 'Base']
  ] as const)(
    'tells %s was not found, what to check, and offers Dismiss',
    async (_label, bridge, wait, name) => {
      const card = show(await afterUnknownSourcePoll(bridge, wait), wait);

      expect(card.textContent).toContain(`Not found on ${name}`);
      expect(screen.getByTestId('pending-bridge-note').textContent).toBe(
        `${name} has no record of this transaction. Your wallet probably dropped or replaced it. Check your wallet's activity: if it was replaced and went through, look it up with its new hash.`
      );
      expect(screen.getByTestId('pending-bridge-dismiss-hint').textContent).toBe(
        'Dismiss it only if your wallet shows it never went through.'
      );
      // Not a failure: the chain may still show it.
      expect(screen.getByTestId('pending-bridge-status').textContent).toBe('Pending');

      fireEvent.click(screen.getByTestId('pending-bridge-dismiss'));
      expect(pendingBridgeStore.getSnapshot('scope')).toEqual([]);
    }
  );

  it('offers neither while the transaction may still mine', async () => {
    const card = show(await afterUnknownSourcePoll(CCTP, 14 * MINUTE), 14 * MINUTE);

    expect(card.textContent).not.toContain('Not found');
    expect(screen.queryByTestId('pending-bridge-dismiss')).toBeNull();
    expect(screen.queryByTestId('pending-bridge-dismiss-hint')).toBeNull();
    expect(screen.queryByTestId('pending-bridge-note')).toBeNull();
  });
});
