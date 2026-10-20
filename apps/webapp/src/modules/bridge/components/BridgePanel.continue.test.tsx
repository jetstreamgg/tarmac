/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { BridgePanel } from './BridgePanel';

const mocks = vi.hoisted(() => ({
  continueBridge: vi.fn(),
  onContinue: undefined as ((swap: UnfinishedCctpSwap) => void) | undefined,
  launchAction: vi.fn(),
  actionHint: vi.fn(),
  list: {} as Record<string, unknown>
}));

vi.mock('../hooks/useBridgeForm', () => ({
  useBridgeForm: () => ({ isConnected: true, reviewBlocked: false, refetchBalances: vi.fn(), reset: vi.fn() })
}));
vi.mock('../hooks/useBridgeLaunch', () => ({
  useBridgeLaunch: () => ({ launch: vi.fn(), locked: false, restore: vi.fn() })
}));
vi.mock('../hooks/useDestinationActionLaunch', () => ({
  useDestinationActionLaunch: () => ({
    launch: mocks.launchAction,
    canLaunch: vi.fn(),
    actionHint: mocks.actionHint,
    locked: false
  })
}));
vi.mock('../hooks/useCctpResumeLaunch', () => ({
  useCctpResumeLaunch: () => ({ launch: mocks.continueBridge })
}));
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({ useConnectThenAct: (fn: () => void) => fn }));
vi.mock('./BridgeCard', () => ({ BridgeCard: () => null }));
vi.mock('./PendingBridges', () => ({
  PendingBridges: (props: { onContinue: (swap: UnfinishedCctpSwap) => void }) => {
    mocks.onContinue = props.onContinue;
    mocks.list = props;
    return null;
  }
}));

vi.mock('./CctpClaimLookup', () => ({ CctpClaimLookup: () => <div data-testid="claim-lookup" /> }));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));
afterEach(cleanup);

it("continues a pending list's unfinished swap through the resume launch", () => {
  render(
    <I18nProvider i18n={i18n}>
      <BridgePanel />
    </I18nProvider>
  );
  expect(mocks.onContinue).toBe(mocks.continueBridge);
});

// A conversion's amount and hint reach the destination launch unchanged.
it("sends a card's actions, conversion included, through the destination launch", () => {
  render(
    <I18nProvider i18n={i18n}>
      <BridgePanel />
    </I18nProvider>
  );
  expect(mocks.list.onAction).toBe(mocks.launchAction);
  expect(mocks.list.actionHint).toBe(mocks.actionHint);
});

it('offers the lookup for an unclaimed bridge under the pending list', () => {
  render(
    <I18nProvider i18n={i18n}>
      <BridgePanel />
    </I18nProvider>
  );
  expect(screen.getByTestId('claim-lookup')).toBeTruthy();
});
