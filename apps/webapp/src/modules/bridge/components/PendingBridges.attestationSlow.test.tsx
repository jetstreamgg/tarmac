/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { PendingBridges } from './PendingBridges';

// The card of a mined CCTP burn past its ETA says what it waits for, and
// promises a Claim only to the wallet that can claim.

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x00000000000000000000000000000000000b0b01';
const THIRD = '0x00000000000000000000000000000000000c0c02';
const MINUTE = 60_000;
const HASH = `0x${'c4'.repeat(32)}`;
const LATE = 'Circle’s attestation is taking longer than usual.'.replace('’', "'");
const CLAIM_HERE = `${LATE} Nothing to do: Claim will appear here when it's ready.`;
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
  sourceMinedAt: MINUTE,
  etaAt: 20 * MINUTE,
  txHash: HASH,
  actions: []
};

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

describe('a mined CCTP burn past its ETA', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('tells the wallet that claims what it waits for and that nothing is needed', () => {
    const card = show(CCTP, 21 * MINUTE);

    expect(card.textContent).toContain('Taking longer than expected');
    expect(screen.getByTestId('pending-bridge-note').textContent).toBe(CLAIM_HERE);
    // Late is not lost.
    expect(screen.getByTestId('pending-bridge-status').textContent).toBe('Pending');
    expect(screen.queryByTestId('pending-bridge-dismiss')).toBeNull();
  });

  it('tells a recipient following an incoming burn the same', () => {
    show({ ...CCTP, account: OTHER, recipient: ACCOUNT }, 21 * MINUTE);
    expect(screen.getByTestId('pending-bridge-note').textContent).toBe(CLAIM_HERE);
  });

  it.each([
    ['the sender of a burn to another wallet', { recipient: OTHER }],
    ['a wallet that neither sent nor receives it', { account: OTHER, recipient: THIRD }]
  ])('tells %s it is late without promising a Claim here', (_label, change) => {
    show({ ...CCTP, ...change }, 21 * MINUTE);
    expect(screen.getByTestId('pending-bridge-note').textContent).toBe(LATE);
  });

  it('says nothing before the ETA', () => {
    const card = show(CCTP, 19 * MINUTE);

    expect(card.textContent).not.toContain('Taking longer than expected');
    expect(screen.queryByTestId('pending-bridge-note')).toBeNull();
  });

  it('says nothing about Circle while the burn was never read as mined', () => {
    const unread = { ...CCTP };
    delete unread.sourceMinedAt;
    show(unread, 21 * MINUTE);
    expect(screen.queryByTestId('pending-bridge-note')).toBeNull();
  });
});
