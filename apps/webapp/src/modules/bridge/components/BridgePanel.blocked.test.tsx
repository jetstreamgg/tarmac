/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { BridgeBlockReason } from '../model/resolveRoute';
import type { BridgeNetworkId } from '../model/networks';
import { BridgePanel } from './BridgePanel';

const form = vi.hoisted(() => ({
  isConnected: true,
  reviewBlocked: true,
  refetchBalances: () => {},
  reset: () => {},
  from: 'base' as BridgeNetworkId,
  to: 'ethereum' as BridgeNetworkId,
  blockedReason: undefined as BridgeBlockReason | undefined
}));

vi.mock('../hooks/useBridgeForm', () => ({ useBridgeForm: () => form }));
vi.mock('../hooks/useBridgeLaunch', () => ({
  useBridgeLaunch: () => ({ launch: vi.fn(), locked: false, restore: vi.fn() })
}));
vi.mock('../hooks/useDestinationActionLaunch', () => ({
  useDestinationActionLaunch: () => ({
    launch: vi.fn(),
    canLaunch: vi.fn(),
    actionHint: vi.fn(),
    locked: false
  })
}));
vi.mock('../hooks/useCctpResumeLaunch', () => ({ useCctpResumeLaunch: () => ({ launch: vi.fn() }) }));
vi.mock('../hooks/useCctpSwapConvertLaunch', () => ({
  useCctpSwapConvertLaunch: () => ({ launch: vi.fn() })
}));
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({ useConnectThenAct: (fn: () => void) => fn }));
vi.mock('./BridgeCard', () => ({ BridgeCard: () => null }));
vi.mock('./PendingBridges', () => ({ PendingBridges: () => null }));
vi.mock('./BridgeClaimLookup', () => ({ BridgeClaimLookup: () => null, hasBridgeClaimLookup: () => false }));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));
afterEach(cleanup);

const blocked = (from: BridgeNetworkId, to: BridgeNetworkId, reason: BridgeBlockReason) => {
  Object.assign(form, { from, to, blockedReason: reason });
  render(
    <I18nProvider i18n={i18n}>
      <BridgePanel />
    </I18nProvider>
  );
  return screen.getByTestId('bridge-blocked').textContent;
};

// Both routes of an L2 to Ethereum withdrawal are down: the approved copy names the pair.
describe('a blocked withdrawal to Ethereum', () => {
  it.each<BridgeBlockReason>(['closed', 'no-liquidity', 'pair-not-allowed'])(
    'says the pair is unavailable (%s)',
    reason => {
      expect(blocked('base', 'ethereum', reason)).toBe(
        'Bridging from Base to Ethereum is unavailable right now. Try again later.'
      );
    }
  );

  it('names the source network', () => {
    expect(blocked('optimism', 'ethereum', 'closed')).toBe(
      'Bridging from OP Mainnet to Ethereum is unavailable right now. Try again later.'
    );
  });

  it('asks for a smaller amount when it is over every limit', () => {
    expect(blocked('arbitrum', 'ethereum', 'over-limit')).toBe(
      'This amount is above what can be bridged right now. Try a smaller amount.'
    );
  });
});

describe('a blocked deposit from Ethereum', () => {
  it.each<[BridgeBlockReason, string]>([
    ['over-limit', 'This amount is over the bridge limit. Try a smaller amount.'],
    ['no-liquidity', 'Not enough liquidity on the destination for this amount. Try a smaller amount.'],
    ['facts-error', "We couldn't check this route. Try again in a moment."],
    ['closed', 'This route is temporarily unavailable.']
  ])('keeps its message (%s)', (reason, text) => {
    expect(blocked('ethereum', 'base', reason)).toBe(text);
  });
});
