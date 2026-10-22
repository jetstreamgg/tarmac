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
const OTHER = '0x00000000000000000000000000000000000b0b01';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  setParams: vi.fn(),
  state: { status: 'idle' } as CctpClaimLookupState,
  targets: [] as (CctpClaimTarget | undefined)[],
  attempts: [] as number[],
  account: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' as string | undefined,
  live: new Set<string>()
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
vi.mock('./BridgeNetworkSelect', () => ({
  BridgeNetworkSelect: ({
    value,
    options,
    onChange,
    dataTestId
  }: {
    value: string;
    options: string[];
    onChange: (next: string) => void;
    dataTestId: string;
  }) => (
    <select data-testid={dataTestId} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}));

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
// The params left after the strip the setter was called with.
const strippedParams = () => {
  const [update] = mocks.setParams.mock.calls[mocks.setParams.mock.calls.length - 1];
  return Object.fromEntries(update(new URLSearchParams(mocks.params)));
};

describe('CctpClaimLookup', () => {
  beforeEach(() => {
    mocks.params = new URLSearchParams('tab=bridge');
    mocks.setParams.mockClear();
    mocks.state = { status: 'idle' };
    mocks.targets = [];
    mocks.attempts = [];
    mocks.account = SENDER;
    mocks.live = new Set(['base', 'arbitrum', 'optimism', 'unichain']);
  });
  afterEach(cleanup);

  it('starts closed, behind a secondary option, and looks nothing up', () => {
    renderLookup();
    expect(screen.getByTestId('bridge-claim-lookup-open').textContent).toBe(
      "Can't find your unclaimed transaction?"
    );
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(lastTarget()).toBeUndefined();
  });

  it('looks up the network and the lower-case hash entered', () => {
    renderLookup();
    open();
    fireEvent.change(screen.getByTestId('bridge-claim-lookup-network'), { target: { value: 'unichain' } });
    typeHash(`  ${HASH.toUpperCase().replace('0X', '0x')} `);
    expect(lastTarget()).toBeUndefined();
    find();
    expect(lastTarget()).toEqual({ from: 'unichain', txHash: HASH });
  });

  it('offers only the networks that bridge to Ethereum through CCTP, Base first', () => {
    renderLookup();
    open();
    const select = screen.getByTestId('bridge-claim-lookup-network') as HTMLSelectElement;
    expect(select.value).toBe('base');
    expect([...select.options].map(option => option.value)).toEqual([
      'base',
      'arbitrum',
      'optimism',
      'unichain'
    ]);
  });

  it('shows nothing while no network bridges to Ethereum through CCTP, a claim link included', () => {
    mocks.live = new Set();
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(screen.queryByTestId('bridge-claim-lookup-open')).toBeNull();
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(mocks.targets.every(target => target === undefined)).toBe(true);
  });

  it('offers only the networks whose bridge to Ethereum is live', () => {
    mocks.live = new Set(['arbitrum', 'unichain']);
    renderLookup();
    open();
    const select = screen.getByTestId('bridge-claim-lookup-network') as HTMLSelectElement;
    expect(select.value).toBe('arbitrum');
    expect([...select.options].map(option => option.value)).toEqual(['arbitrum', 'unichain']);
  });

  it('ignores a claim link from a network whose bridge to Ethereum is not live', () => {
    mocks.live = new Set(['base']);
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(mocks.targets.every(target => target === undefined)).toBe(true);
  });

  it.each([['0xabcd'], [`0x${'zz'.repeat(32)}`], ['']])('refuses %j as a hash without a lookup', value => {
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
    fireEvent.change(screen.getByTestId('bridge-claim-lookup-network'), { target: { value: 'optimism' } });
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
    expect((screen.getByTestId('bridge-claim-lookup-network') as HTMLSelectElement).value).toBe('arbitrum');
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

  it('shows a found burn and adds it to the list, then closes', () => {
    const add = vi.fn();
    mocks.state = { status: 'found', bridge: BURN, add };
    mocks.params = new URLSearchParams(`tab=bridge&claim_network=arbitrum&claim_tx=${HASH}`);
    renderLookup();
    const found = screen.getByTestId('bridge-claim-lookup-found');
    expect(found.textContent).toContain('1,250.00');
    expect(found.textContent).toContain('Arbitrum One');
    fireEvent.click(screen.getByTestId('bridge-claim-lookup-add'));
    expect(add).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('bridge-claim-lookup-form')).toBeNull();
    expect(strippedParams()).toEqual({ tab: 'bridge' });
  });

  it('tells the sender of a burn to another wallet that only that wallet can claim it', () => {
    mocks.state = { status: 'found', bridge: { ...BURN, recipient: OTHER }, add: vi.fn() };
    renderLookup();
    open();
    expect(screen.getByTestId('bridge-claim-lookup-found').textContent).toContain(
      'Only the destination wallet (0x0000...0b01) can claim it on Ethereum.'
    );
  });

  it('says nothing about the destination wallet to the recipient', () => {
    mocks.account = OTHER;
    mocks.state = { status: 'found', bridge: { ...BURN, recipient: OTHER }, add: vi.fn() };
    renderLookup();
    open();
    expect(screen.getByTestId('bridge-claim-lookup-found').textContent).not.toContain('destination wallet');
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
    [{ status: 'disconnected' }, 'bridge-claim-lookup-message', 'Connect your wallet to look it up.'],
    [{ status: 'loading' }, 'bridge-claim-lookup-message', 'Looking up your bridge'],
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
      "We couldn't find this transaction on Base. Check the network and the hash."
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
    ],
    [
      { status: 'refused', reason: 'not-yours', recipient: OTHER },
      'bridge-claim-lookup-error',
      'This bridge goes to 0x0000...0b01. Connect that wallet to claim it.'
    ]
  ])('says %j', (state, testId, copy) => {
    mocks.state = state;
    renderLookup();
    open();
    typeHash(HASH);
    find();
    expect(screen.getByTestId(testId).textContent).toBe(copy);
  });
});
