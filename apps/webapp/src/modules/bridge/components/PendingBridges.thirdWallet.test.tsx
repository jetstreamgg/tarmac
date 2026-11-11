/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { PendingBridges } from './PendingBridges';

// A wallet that neither sent nor receives a bridge can take it off its list;
// the wallets that can act on it are never offered that.

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SENDER = '0x00000000000000000000000000000000000b0b01';
const RECIPIENT = '0x00000000000000000000000000000000000c0c02';
const SCOPE = `1:${ACCOUNT}`;
const SENDER_SCOPE = `1:${SENDER}`;
const MINUTE = 60_000;
const HASH = `0x${'c4'.repeat(32)}`;
const THIRD: PendingBridge = {
  id: HASH,
  account: SENDER,
  recipient: RECIPIENT,
  amount: 10n ** 18n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'ready',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: 0,
  sourceMinedAt: MINUTE,
  etaAt: 20 * MINUTE,
  txHash: HASH,
  actions: []
};

const mocks = vi.hoisted(() => ({
  bridges: [] as PendingBridge[],
  incoming: [] as { bridge: PendingBridge; scope: string }[]
}));

vi.mock('wagmi', () => ({ useEnsName: () => ({ data: undefined }) }));
vi.mock('@/modules/ui/components/Avatar', () => ({ CustomAvatar: () => <span /> }));
vi.mock('@/modules/ui/context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: vi.fn() })
}));
vi.mock('@/components/ui/use-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('posthog-js/react', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => <span /> }));
vi.mock('../hooks/usePendingBridges', () => ({
  usePendingBridges: () => ({ bridges: mocks.bridges, now: 21 * MINUTE })
}));
vi.mock('../hooks/useIncomingCctpBridges', () => ({ useIncomingCctpBridges: () => mocks.incoming }));
vi.mock('../hooks/usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, familyChainId: 1, scope: SCOPE })
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

const show = () =>
  render(
    <I18nProvider i18n={i18n}>
      <PendingBridges {...props} />
    </I18nProvider>
  );

const showOwn = (bridge: PendingBridge) => {
  pendingBridgeStore.upsert(SCOPE, bridge);
  mocks.bridges = [bridge];
  mocks.incoming = [];
  show();
};

const removal = () =>
  screen.queryByTestId('pending-bridge-remove') ?? screen.queryByTestId('pending-bridge-dismiss');

describe('a bridge on the list of a wallet that neither sent nor receives it', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it.each([
    ['ready to claim', THIRD],
    ['on its way', { ...THIRD, status: 'pending' as const }],
    [
      'a native withdrawal waiting for its prove',
      { ...THIRD, routeKind: 'native' as const, nextAction: 'prove' as const }
    ]
  ])('can be taken off the list, %s', (_label, bridge) => {
    showOwn(bridge);

    const control = removal();
    expect(control).not.toBeNull();
    fireEvent.click(control!);

    expect(pendingBridgeStore.getSnapshot(SCOPE)).toEqual([]);
  });

  it('still says which wallet claims it', () => {
    showOwn(THIRD);

    expect(screen.getByTestId('pending-bridge-third-wallet-note')).toBeTruthy();
    expect(screen.getByTestId('pending-bridge-claim-elsewhere')).toBeTruthy();
  });
});

describe('a bridge a wallet can act on or follow', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it.each([
    ['it sent to itself', { ...THIRD, account: ACCOUNT, recipient: undefined }],
    ['it sent to another wallet', { ...THIRD, account: ACCOUNT }],
    ['it receives, brought in with a claim link', { ...THIRD, recipient: ACCOUNT }]
  ])('is never offered a removal: one %s', (_label, bridge) => {
    showOwn(bridge as PendingBridge);

    expect(screen.getByTestId('pending-bridge-card')).toBeTruthy();
    expect(removal()).toBeNull();
  });

  it("is never offered a removal: one it receives, shown from its sender's list", () => {
    const incoming = { ...THIRD, recipient: ACCOUNT };
    pendingBridgeStore.upsert(SENDER_SCOPE, incoming);
    mocks.bridges = [];
    mocks.incoming = [{ bridge: incoming, scope: SENDER_SCOPE }];
    show();

    expect(screen.getByTestId('pending-bridge-card')).toBeTruthy();
    expect(removal()).toBeNull();
    expect(pendingBridgeStore.getSnapshot(SENDER_SCOPE)).toHaveLength(1);
  });
});
