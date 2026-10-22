/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import type { CctpClaimLookupState, CctpClaimTarget } from '../hooks/useCctpClaimLookup';
import type { PendingBridge } from '../model/types';
import { CctpClaimLookup } from './CctpClaimLookup';

const HASH = `0x${'ab'.repeat(32)}` as Hex;
const SENDER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  setParams: vi.fn(),
  state: { status: 'idle' } as CctpClaimLookupState,
  targets: [] as (CctpClaimTarget | undefined)[],
  attempts: [] as number[],
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' as string | undefined,
  live: new Set<string>(),
  toast: { success: vi.fn(), error: vi.fn() },
  openConnectModal: vi.fn()
}));

vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/modules/ui/context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: mocks.openConnectModal })
}));

vi.mock('../model/pairs', () => ({
  isLivePair: ({ from, to }: { from: string; to: string }) => to === 'ethereum' && mocks.live.has(from)
}));
vi.mock('@/lib/navigation', () => ({ useAppSearchParams: () => [mocks.params, mocks.setParams] }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('../hooks/usePendingScope', () => ({
  usePendingScope: () => ({ account: mocks.account, familyChainId: 1, scope: 'scope' })
}));
vi.mock('../hooks/useCctpClaimLookup', () => ({
  useCctpClaimLookup: (target: CctpClaimTarget | undefined, attempt: number) => {
    mocks.targets.push(target);
    mocks.attempts.push(attempt);
    return mocks.state;
  }
}));
vi.mock('./BridgeNetworkIcon', () => ({ BridgeNetworkIcon: () => null }));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const BURN: PendingBridge = {
  id: HASH,
  account: SENDER,
  amount: 1_250n * 10n ** 18n,
  token: 'USDS',
  from: 'arbitrum',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: 0,
  etaAt: 0,
  txHash: HASH,
  actions: []
};

const renderLookup = () =>
  render(
    <I18nProvider i18n={i18n}>
      <CctpClaimLookup />
    </I18nProvider>
  );
const lastTarget = () => mocks.targets[mocks.targets.length - 1];
const open = () => fireEvent.click(screen.getByTestId('bridge-claim-lookup-open'));
const typeHash = (value: string) =>
  fireEvent.change(screen.getByTestId('bridge-claim-lookup-hash'), { target: { value } });
const find = () => fireEvent.click(screen.getByTestId('bridge-claim-lookup-find'));
const pickNetwork = (network: string) =>
  fireEvent.click(screen.getByTestId(`bridge-claim-lookup-network-${network}`));
// The source network pills, in order, and the one checked.
const networkPills = () =>
  screen
    .getAllByRole('radio')
    .map(pill => pill.getAttribute('data-testid')?.replace('bridge-claim-lookup-network-', ''));
const checkedNetwork = () =>
  screen
    .getAllByRole('radio')
    .find(pill => pill.getAttribute('aria-checked') === 'true')
    ?.getAttribute('data-testid')
    ?.replace('bridge-claim-lookup-network-', '');
// The params left after the strip the setter was called with.
const strippedParams = () => {
  const [update] = mocks.setParams.mock.calls[mocks.setParams.mock.calls.length - 1];
  return Object.fromEntries(update(new URLSearchParams(mocks.params)));
};

describe('CctpClaimLookup', () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams('tab=bridge');
    mocks.setParams.mockClear();
    mocks.openConnectModal.mockClear();
    mocks.state = { status: 'idle' };
    mocks.targets = [];
    mocks.attempts = [];
    mocks.account = SENDER;
    mocks.live = new Set(['base', 'arbitrum', 'optimism', 'unichain']);
    mocks.toast.success.mockClear();
    mocks.toast.error.mockClear();
  });
  afterEach(cleanup);

  // Figma 81.
  it('starts with the banner, the lookup closed, and looks nothing up', () => {
    renderLookup();
    const banner = screen.getByTestId('bridge-claim-lookup-banner');
    expect(banner.textContent).toContain("Can't find your bridge?");
    expect(banner.textContent).toContain(
      'If you sent it from another device or browser, or someone sent it to you, find it with the transaction hash and claim it here.'
    );
    expect(screen.getByTestId('bridge-claim-lookup-open').textContent).toBe('Find bridge');
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(lastTarget()).toBeUndefined();
  });

  // Figma 82.
  it('opens the lookup in a modal from the banner', () => {
    renderLookup();
    open();
    const form = screen.getByTestId('bridge-claim-lookup-form');
    expect(form.textContent).toContain('Find your bridge');
    expect(form.textContent).toContain(
      "Enter the network you bridged from and the transaction hash. We'll look it up so you can claim it."
    );
    expect(form.textContent).toContain('Source network');
    expect(form.textContent).toContain(
      "You'll find it in your wallet's activity or on the block explorer of the network you bridged from."
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps Find disabled while no hash is entered', () => {
    renderLookup();
    open();
    expect((screen.getByTestId('bridge-claim-lookup-find') as HTMLButtonElement).disabled).toBe(true);
    typeHash('   ');
    expect((screen.getByTestId('bridge-claim-lookup-find') as HTMLButtonElement).disabled).toBe(true);
    typeHash(HASH);
    expect((screen.getByTestId('bridge-claim-lookup-find') as HTMLButtonElement).disabled).toBe(false);
  });

  // Figma 84.
  it('shows the lookup in a disabled Find while it runs', () => {
    mocks.state = { status: 'loading' };
    renderLookup();
    open();
    typeHash(HASH);
    find();
    const button = screen.getByTestId('bridge-claim-lookup-find') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Looking up your bridge');
    expect(screen.getByTestId('bridge-claim-lookup-helper')).toBeTruthy();
  });

  it('looks up the network and the lower-case hash entered', () => {
    renderLookup();
    open();
    pickNetwork('unichain');
    typeHash(`  ${HASH.toUpperCase().replace('0X', '0x')} `);
    expect(lastTarget()).toBeUndefined();
    find();
    expect(lastTarget()).toEqual({ from: 'unichain', txHash: HASH });
  });

  it('offers only the networks that bridge to Ethereum through CCTP, Base first', () => {
    renderLookup();
    open();
    expect(checkedNetwork()).toBe('base');
    expect(networkPills()).toEqual(['base', 'arbitrum', 'optimism', 'unichain']);
  });

  it('shows nothing while no network bridges to Ethereum through CCTP, a claim link included', () => {
    mocks.live = new Set();
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(screen.queryByTestId('bridge-claim-lookup-banner')).toBeNull();
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(mocks.targets.every(target => target === undefined)).toBe(true);
  });

  it('offers only the networks whose bridge to Ethereum is live', () => {
    mocks.live = new Set(['arbitrum', 'unichain']);
    renderLookup();
    open();
    expect(checkedNetwork()).toBe('arbitrum');
    expect(networkPills()).toEqual(['arbitrum', 'unichain']);
  });

  it('ignores a claim link from a network whose bridge to Ethereum is not live', () => {
    mocks.live = new Set(['base']);
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(mocks.targets.every(target => target === undefined)).toBe(true);
  });

  it.each([['0xabcd'], [`0x${'zz'.repeat(32)}`]])('refuses %j as a hash without a lookup', value => {
    renderLookup();
    open();
    typeHash(value);
    find();
    expect(screen.getByTestId('bridge-claim-lookup-invalid')).toBeTruthy();
    expect(lastTarget()).toBeUndefined();
  });

  it('clears the invalid hash message once the hash changes', () => {
    renderLookup();
    open();
    typeHash('0xabcd');
    find();
    expect(screen.getByTestId('bridge-claim-lookup-invalid')).toBeTruthy();
    typeHash(HASH);
    expect(screen.queryByTestId('bridge-claim-lookup-invalid')).toBeNull();
  });

  it('drops the last lookup once the hash or the network changes', () => {
    renderLookup();
    open();
    typeHash(HASH);
    find();
    expect(lastTarget()).toEqual({ from: 'base', txHash: HASH });
    pickNetwork('optimism');
    expect(lastTarget()).toBeUndefined();
    find();
    typeHash(`0x${'cd'.repeat(32)}`);
    expect(lastTarget()).toBeUndefined();
  });

  it('looks the same burn up again on each Find', () => {
    mocks.state = { status: 'refused', reason: 'not-found' };
    renderLookup();
    open();
    typeHash(HASH);
    find();
    const first = mocks.attempts[mocks.attempts.length - 1];
    find();
    expect(lastTarget()).toEqual({ from: 'base', txHash: HASH });
    expect(mocks.attempts[mocks.attempts.length - 1]).not.toBe(first);
  });

  it('opens from a claim link and looks it up straight away', () => {
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(screen.getByTestId('bridge-claim-lookup-form')).toBeTruthy();
    expect(checkedNetwork()).toBe('arbitrum');
    expect((screen.getByTestId('bridge-claim-lookup-hash') as HTMLInputElement).value).toBe(HASH);
    expect(mocks.targets[0]).toEqual({ from: 'arbitrum', txHash: HASH });
  });

  it("closes and strips the link's params, keeping the tab", () => {
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    fireEvent.click(screen.getByTestId('bridge-claim-lookup-close'));
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(strippedParams()).toEqual({ tab: 'bridge' });
    expect(mocks.setParams.mock.calls[0][1]).toEqual({ replace: true });
  });

  // Figma 86.
  it('adds a found burn to the list straight away, closes and toasts', () => {
    const add = vi.fn();
    mocks.state = { status: 'found', bridge: BURN, add };
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(add).toHaveBeenCalled();
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(strippedParams()).toEqual({ tab: 'bridge' });
    expect(mocks.toast.success).toHaveBeenCalledWith('Bridge found!', expect.anything());
  });

  it('adds nothing before a lookup finds the burn', () => {
    renderLookup();
    open();
    typeHash(HASH);
    expect(mocks.toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('bridge-claim-lookup-form')).toBeTruthy();
  });

  // Figma 85.
  it('toasts that there is no bridge with the hash on its network', () => {
    mocks.state = { status: 'refused', reason: 'not-found' };
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "We couldn't find this bridge",
      expect.objectContaining({
        description:
          "There's no CCTP bridge with this hash on Arbitrum One. Check that the network and the hash are correct."
      })
    );
  });

  it('toasts no other refusal', () => {
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    for (const reason of ['reverted', 'not-a-bridge', 'several-burns'] as const) {
      mocks.state = { status: 'refused', reason } as CctpClaimLookupState;
      renderLookup();
      cleanup();
    }
    mocks.state = { status: 'error', retry: () => {} };
    renderLookup();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it('disconnected, connects from the modal and keeps the claim link to look it up', () => {
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    mocks.state = { status: 'disconnected' };
    renderLookup();
    expect(screen.getByTestId('bridge-claim-lookup-message').textContent).toBe(
      'Connect your wallet to look it up.'
    );
    expect(screen.queryByTestId('bridge-claim-lookup-find')).toBeNull();
    fireEvent.click(screen.getByTestId('bridge-claim-lookup-connect'));
    expect(mocks.openConnectModal).toHaveBeenCalledOnce();
    expect(mocks.setParams).not.toHaveBeenCalled();
    expect(lastTarget()).toEqual({ from: 'arbitrum', txHash: HASH });
  });

  it('retries a failed read', () => {
    const retry = vi.fn();
    mocks.state = { status: 'error', retry };
    renderLookup();
    open();
    fireEvent.click(screen.getByTestId('bridge-claim-lookup-retry'));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each<[CctpClaimLookupState, string, string]>([
    [{ status: 'known' }, 'bridge-claim-lookup-message', 'This bridge is already in your list.'],
    [
      { status: 'known', claimed: true },
      'bridge-claim-lookup-message',
      'This bridge has already been claimed.'
    ],
    [
      { status: 'error', retry: () => {} },
      'bridge-claim-lookup-error',
      "We couldn't read this transaction. Try again in a moment."
    ],
    [
      { status: 'refused', reason: 'not-found' },
      'bridge-claim-lookup-error',
      "There's no CCTP bridge with this hash on Base."
    ],
    [
      { status: 'refused', reason: 'reverted' },
      'bridge-claim-lookup-error',
      'This transaction failed on Base, so nothing was bridged.'
    ],
    [
      { status: 'refused', reason: 'not-a-bridge' },
      'bridge-claim-lookup-error',
      "This transaction isn't a USDS bridge to Ethereum that this app can claim."
    ],
    [
      { status: 'refused', reason: 'several-burns' },
      'bridge-claim-lookup-error',
      "This transaction sends more than one bridge, so this app can't claim it."
    ]
  ])('says %j', (state, testId, copy) => {
    mocks.state = state;
    renderLookup();
    open();
    typeHash(HASH);
    find();
    expect(screen.getByTestId(testId).textContent).toBe(copy);
  });

  // Figma 85.
  it.each<CctpClaimLookupState>([
    { status: 'refused', reason: 'not-found' },
    { status: 'error', retry: () => {} }
  ])('marks the hash invalid and drops the helper on %j', state => {
    mocks.state = state;
    renderLookup();
    open();
    typeHash(HASH);
    find();
    expect(screen.getByTestId('bridge-claim-lookup-hash').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByTestId('bridge-claim-lookup-helper')).toBeNull();
  });

  it('shows the helper under a hash not looked up yet', () => {
    renderLookup();
    open();
    typeHash(HASH);
    expect(screen.getByTestId('bridge-claim-lookup-hash').getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByTestId('bridge-claim-lookup-helper')).toBeTruthy();
  });
});
