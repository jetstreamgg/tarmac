import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import type { PreflightHook, PreTransactionGate } from './preTransactionGate';

// The cross-chain-calldata guard (APP-528). A transaction modal survives a
// wallet chain switch (the provider lives above the router), and its editable
// body then rebuilds calldata against the new chain — resolving a product
// address on a chain it doesn't live on, which sends against a codeless (or
// attacker-occupied) address. The provider must block every first-screen CTA
// and offer a switch back whenever the connected wallet leaves a flow's
// declared `supportedChainIds`. Once a write has been attempted the rule is
// stricter and chain-set-agnostic: everything the session holds past IDLE was
// built for the chain the write started on, so a switch to ANY other chain —
// a supported one included, which is the multi-chain Savings/Convert case —
// ends the session instead of leaving a Retry that no-ops or fires stale
// calls. These tests pin both behaviours so they can't regress.

// Mutable so each test can place the wallet on any chain before rendering. The
// wagmi mock reads through these — vi.mock is hoisted, so a plain closure over
// module-level `let`s is the way to vary a mocked hook per test.
let mockChainId = 1;
// The wallet's own chain, which differs from wagmi's `useChainId()` only when
// the wallet has left the app's configured set. undefined = the two agree.
let mockConnectedChainId: number | undefined;
let mockAddress: string | undefined = '0x0000000000000000000000000000000000000001';
const mockChains = [
  { id: 1, name: 'Ethereum' },
  { id: 8453, name: 'Base' },
  { id: 42161, name: 'Arbitrum One' }
];

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => mockChainId,
  useChains: () => mockChains,
  useConnection: () => ({
    address: mockAddress,
    chainId: mockConnectedChainId,
    isConnected: true
  })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => mockIsSafeWallet,
  useIsBatchSupported: () => ({ data: false })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackWidgetReviewViewed: vi.fn(),
    trackTransactionStarted: vi.fn(),
    trackTransactionCompleted: vi.fn()
  })
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));

// The provider's toasts: the close-on-switch and the refused-verdict notices
// are asserted by rendering the node handed to toastWithClose.
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: toastWithCloseMock
}));
const lastToastText = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>).container.textContent;
};

// Spy on the chain switch the guard triggers, without a real WagmiProvider.
const mockHandleSwitchChain = vi.fn();
let mockIsSafeWallet = false;
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    handleSwitchChain: mockHandleSwitchChain,
    isSwitchPending: false,
    switchVariables: undefined
  })
}));

// Render motion elements synchronously so AnimatePresence transitions are deterministic.
vi.mock('motion/react', async io => {
  const actual = await io<typeof import('motion/react')>();
  const React = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout']);
  const strip = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)));
  const tag =
    (element: string) =>
    ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
      React.createElement(element, strip(rest), children);
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, element) => tag(element as string) })
  };
});

import { TransactionProvider, useTransaction } from './TransactionContext';

i18n.load('en', {});
i18n.activate('en');

function Harness({
  build,
  onReady
}: {
  build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig;
  onReady: (api: ReturnType<typeof useTransaction>) => void;
}) {
  const api = useTransaction();
  const { launch, txCallbacks } = api;
  const started = useRef(false);
  const cbRef = useRef(txCallbacks);
  useEffect(() => {
    cbRef.current = txCallbacks;
  });
  const [liveCb] = useState<ReturnType<typeof useTransaction>['txCallbacks']>(() => ({
    onMutate: () => cbRef.current.onMutate(),
    onStart: hash => cbRef.current.onStart(hash),
    onSuccess: hash => cbRef.current.onSuccess(hash),
    onError: (error, hash) => cbRef.current.onError(error, hash)
  }));
  useEffect(() => {
    onReady(api);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(build(liveCb));
  }, [launch, build, liveCb]);
  return null;
}

function renderModal(
  build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig,
  onReady?: (api: ReturnType<typeof useTransaction>) => void
) {
  let api: ReturnType<typeof useTransaction> | null = null;
  const tree = () => (
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness
            build={build}
            onReady={latest => {
              api = latest;
              onReady?.(latest);
            }}
          />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  const result = render(tree());
  // Re-renders the same tree so the wagmi mocks re-read the module-level chain
  // lets. That is how a test moves the wallet under an open modal without
  // remounting it — a remount would start a new modal session. The element has
  // to be rebuilt: React bails out of a re-render given the same reference.
  return {
    ...result,
    refresh: () => result.rerender(tree()),
    // The provider owns closing; the reachable public trigger is the shell's
    // per-navigation close, which is also the path the route guard's own
    // redirect-home takes. `launchPathnameRef` latches window.location at
    // launch, so any other pathname ends the session.
    close: () => act(() => api?.closeOnNavigation('/somewhere-else'))
  };
}

// A mainnet-only entry-only flow (the vault/upgrade/rewards shape): one Confirm
// that fires the transaction directly.
const mainnetOnlyConfig = (onConfirm: () => void): TransactionConfig => ({
  title: 'Supply to a mainnet-only product',
  usdValue: 0,
  supportedChainIds: [1, 314310],
  entry: {
    content: <div data-testid="entry-body">fields</div>,
    confirmLabel: 'Confirm',
    confirmDisabled: false
  },
  onConfirm
});

afterEach(() => {
  mockChainId = 1;
  mockConnectedChainId = undefined;
  mockAddress = '0x0000000000000000000000000000000000000001';
  mockIsSafeWallet = false;
  mockHandleSwitchChain.mockReset();
  vi.clearAllMocks();
});

describe('TransactionModal — cross-chain calldata guard (APP-528)', () => {
  it('no guard, and the CTA fires, when the wallet is on a supported chain', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    renderModal(() => mainnetOnlyConfig(onConfirm));

    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('guards: the primary CTA becomes the switch action, and nothing fires onConfirm, when the wallet is on an unsupported chain', () => {
    mockChainId = 8453; // Base — not in the mainnet-only flow's supported set
    const onConfirm = vi.fn();
    renderModal(() => mainnetOnlyConfig(onConfirm));

    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
    // One CTA, not a disabled Confirm beside a switch button.
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    const switchBtn = screen.getByRole('button', { name: 'Switch to Ethereum' });
    expect((switchBtn as HTMLButtonElement).disabled).toBe(false);
    // One attempt was already made automatically when the modal opened; the
    // press adds the user's own, attributed to them.
    expect(mockHandleSwitchChain).toHaveBeenCalledTimes(1);
    fireEvent.click(switchBtn);
    expect(mockHandleSwitchChain).toHaveBeenCalledTimes(2);
    expect(mockHandleSwitchChain).toHaveBeenLastCalledWith({
      chainId: 1,
      source: 'transaction_modal'
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on a wallet switch under a single-step inline failure (a write was attempted)', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let api!: ReturnType<typeof useTransaction>;
    const { refresh } = renderModal(
      cb => ({
        ...mainnetOnlyConfig(onConfirm),
        // One step: the failure renders inside the step list (no bottom CTA row).
        steps: [{ label: 'Supply', tokenSymbol: 'USDS' }],
        onConfirm: () => {
          onConfirm();
          cb.onMutate();
          cb.onStart('0xsupply');
          cb.onError(new Error('boom'), '0xsupply');
        }
      }),
      a => (api = a)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByText('Supply failed')).toBeTruthy();
    expect(api.isModalOpen).toBe(true);

    mockChainId = 8453; // the user switches to Base while looking at the failure
    act(() => refresh());

    // The failed write belongs to mainnet; nothing re-derives it for Base, so
    // the session ends rather than offering a Try again with nothing behind it.
    expect(api.isModalOpen).toBe(false);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('guards a wallet on a chain the app does not configure at all', () => {
    // wagmi REFUSES to move `config.state.chainId` onto an unconfigured chain,
    // so `useChainId()` keeps naming the last configured one (mainnet here)
    // while the wallet sits on, say, Polygon. Reading it would show the guard a
    // supported chain and let a mainnet-addressed transaction fire at whatever
    // lives at that address on Polygon. Only `useConnection().chainId` tells
    // the truth. A blocking dialog used to make this unreachable; it is gone,
    // so this is the pin that keeps the guard honest.
    mockChainId = 1;
    mockConnectedChainId = 137;
    const onConfirm = vi.fn();
    renderModal(() => mainnetOnlyConfig(onConfirm));

    const guard = screen.getByTestId('transaction-chain-guard');
    expect(guard).not.toBeNull();
    // ...and it must not NAME the pinned chain either. Reading `useChainId()`
    // for the copy produced "isn't available on Ethereum. Switch to Ethereum",
    // naming the target as the problem. The config is the only chain registry
    // the app carries, so an unconfigured chain has no name to give — the copy
    // falls back to "this network" rather than guessing.
    expect(guard.textContent).not.toContain('available on Ethereum');
    expect(guard.textContent).toContain('this network');
    expect(guard.textContent).toContain('Switch to Ethereum');

    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Ethereum' }));
    expect(mockHandleSwitchChain).toHaveBeenCalledWith({ chainId: 1, source: 'transaction_modal' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // Opening a product's modal is asking for that product, so it resolves its
  // chain the way arriving on its page does. Portfolio is where this bites: its
  // in-place actions reach mainnet-only products from a surface that runs on
  // any chain.
  it('asks for the supported chain by itself when the modal opens off it', () => {
    mockChainId = 8453; // Base
    renderModal(() => mainnetOnlyConfig(vi.fn()));

    expect(mockHandleSwitchChain).toHaveBeenCalledWith({
      chainId: 1,
      source: 'transaction_modal_auto'
    });
    // Once per modal session — StrictMode double-invokes effects, and a
    // re-render must not re-ask either.
    expect(mockHandleSwitchChain).toHaveBeenCalledTimes(1);
    // The guard stays up until the wallet actually moves: a request is not an
    // answer, and the CTA is what the user has if they declined it.
    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
  });

  it('asks for nothing when the modal opens on a supported chain', () => {
    mockChainId = 1;
    renderModal(() => mainnetOnlyConfig(vi.fn()));
    expect(mockHandleSwitchChain).not.toHaveBeenCalled();
  });

  it('never asks a Safe wallet, which cannot switch from the dapp', () => {
    mockChainId = 8453;
    mockIsSafeWallet = true;
    renderModal(() => mainnetOnlyConfig(vi.fn()));

    expect(mockHandleSwitchChain).not.toHaveBeenCalled();
    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
  });

  // The APP-528 case: the modal is already open and the user changes network in
  // their wallet. That is deliberate, and the app does not argue with it — the
  // guard appears with its CTA, but nothing asks for the chain back. Same rule
  // the route guard follows, where only a navigation earns a prompt.
  it('does NOT ask when the wallet leaves the supported set with the modal already open', () => {
    mockChainId = 1;
    const { refresh } = renderModal(() => mainnetOnlyConfig(vi.fn()));
    expect(mockHandleSwitchChain).not.toHaveBeenCalled();

    mockChainId = 8453; // the user switches to Base themselves
    act(() => refresh());

    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
    expect(screen.queryByTestId('transaction-chain-guard-switch')).not.toBeNull();
    expect(mockHandleSwitchChain).not.toHaveBeenCalled();
  });

  // Closing is the most ordinary thing a user does with a modal, and it must
  // not be read as opening a new one. The session generation bumps on close
  // (so late engine callbacks see themselves as stale) while the view lingers
  // for its exit animation — which leaves the guard live against the closing
  // flow's config for a render. A latch keyed on the generation alone fires
  // there, prompting the wallet for a modal the user just dismissed.
  it('asks for nothing when the modal is closed', () => {
    mockChainId = 8453; // Base — the flow is mainnet-only, so it asks on open
    const { close } = renderModal(() => mainnetOnlyConfig(vi.fn()));
    expect(mockHandleSwitchChain).toHaveBeenCalledTimes(1);

    close();

    expect(mockHandleSwitchChain).toHaveBeenCalledTimes(1);
  });

  // The same hole from the other side, and the worse half: here the user got no
  // prompt on open, changed network deliberately with the modal up, and closing
  // it would ask them to undo that.
  it('asks for nothing when a modal the user moved the wallet under is closed', () => {
    mockChainId = 1;
    const { refresh, close } = renderModal(() => mainnetOnlyConfig(vi.fn()));
    mockChainId = 8453;
    act(() => refresh());
    expect(mockHandleSwitchChain).not.toHaveBeenCalled();

    close();

    expect(mockHandleSwitchChain).not.toHaveBeenCalled();
  });

  it('names the current and target chains and switches on click', () => {
    mockChainId = 8453; // Base
    renderModal(() => mainnetOnlyConfig(vi.fn()));

    const guard = screen.getByTestId('transaction-chain-guard');
    expect(guard.textContent).toContain('Base');
    expect(guard.textContent).toContain('Ethereum');

    const switchBtn = screen.getByTestId('transaction-chain-guard-switch');
    fireEvent.click(switchBtn);
    // The user's own press is attributed to them, not to the automatic attempt
    // that opening the modal already made.
    expect(mockHandleSwitchChain).toHaveBeenLastCalledWith({
      chainId: 1,
      source: 'transaction_modal'
    });
  });

  it('offers NO switch button for a Safe wallet (it cannot switch from the dapp)', () => {
    mockChainId = 8453;
    mockIsSafeWallet = true;
    renderModal(() => mainnetOnlyConfig(vi.fn()));

    // The explanatory guard still shows and still disables the CTA...
    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
    expect((screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement).disabled).toBe(true);
    // ...but no switch action is offered.
    expect(screen.queryByTestId('transaction-chain-guard-switch')).toBeNull();
  });

  // APP-563 #4: Convert's review is priced for its launch chain (quote,
  // allowance, PSM addresses come from the page, not the modal), so it pins
  // `supportedChainIds` to that chain. Switching the wallet under it must then
  // show the guard — and the copy must not claim Convert is unavailable on the
  // new chain, because it usually isn't.
  it('guards a launch-chain-pinned review on a wallet-side switch, with copy that names the launch chain', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    const { refresh } = renderModal(() => ({
      title: 'Review conversion',
      usdValue: 100,
      supportedChainIds: [1],
      chainGuardReason: 'launch-chain',
      confirmLabel: 'Confirm',
      confirmDisabled: false,
      transactionContent: <div>summary</div>,
      onConfirm
    }));
    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    expect(mockHandleSwitchChain).not.toHaveBeenCalled();

    mockChainId = 8453; // the user switches to Base from the wallet mid-review
    act(() => refresh());

    const guard = screen.getByTestId('transaction-chain-guard');
    expect(guard.textContent).toContain('prepared on Ethereum');
    expect(guard.textContent).toContain('start again on Base');
    expect(guard.textContent).not.toContain("isn't available");
    // The switch action replaces Confirm, so the stale figures cannot fire.
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('transaction-chain-guard-switch'));
    expect(mockHandleSwitchChain).toHaveBeenLastCalledWith({ chainId: 1, source: 'transaction_modal' });
  });

  it('does NOT guard a multi-chain flow while the wallet is on any of its supported chains', () => {
    mockChainId = 8453; // Base
    const onConfirm = vi.fn();
    renderModal(() => ({
      title: 'Supply to a multi-chain product',
      usdValue: 0,
      // Savings/convert shape: available on mainnet AND the L2s.
      supportedChainIds: [1, 8453, 42161],
      entry: { content: <div>fields</div>, confirmLabel: 'Confirm', confirmDisabled: false },
      onConfirm
    }));

    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocks a three-screen flow at the entry so it cannot even advance to review', () => {
    mockChainId = 8453; // Base, unsupported
    const onReviewReached = vi.fn();
    renderModal(() => ({
      title: 'Supply (three-screen)',
      usdValue: 0,
      supportedChainIds: [1, 314310],
      // entry + transactionContent === three-screen: entry advances to review.
      transactionContent: <div data-testid="review-body">review</div>,
      entry: { content: <div>fields</div>, confirmLabel: 'Review', confirmDisabled: false },
      onConfirm: onReviewReached
    }));

    // The advancing CTA is gone — the switch stands in its place.
    expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
    fireEvent.click(screen.getByTestId('transaction-chain-guard-switch'));
    // Still on the entry — the review body never mounted.
    expect(screen.queryByTestId('review-body')).toBeNull();
  });

  it('a three-screen flow guarded on its review returns to the entry (the review was built for the old chain)', () => {
    mockChainId = 1;
    renderTestTree(() => ({
      title: 'Supply (three-screen)',
      usdValue: 0,
      supportedChainIds: [1, 314310],
      transactionContent: <div data-testid="review-body">review</div>,
      entry: {
        content: <div data-testid="entry-body">fields</div>,
        confirmLabel: 'Review',
        confirmDisabled: false
      },
      onConfirm: vi.fn()
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.queryByTestId('review-body')).not.toBeNull();

    act(() => {
      mockChainId = 8453;
      forceRerender();
    });

    expect(screen.queryByTestId('review-body')).toBeNull();
    expect(screen.queryByTestId('entry-body')).not.toBeNull();
    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
    expect(screen.queryByTestId('transaction-chain-guard-switch')).not.toBeNull();
  });

  it('collapses a two-action entry to the single switch CTA when guarded', () => {
    mockChainId = 8453;
    renderModal(() => ({
      title: 'Claim & Restake',
      usdValue: 0,
      supportedChainIds: [1, 314310],
      entry: {
        content: <div>fields</div>,
        confirmLabel: 'Claim & Restake',
        confirmDisabled: false,
        secondaryConfirmLabel: 'Claim',
        secondaryConfirmDisabled: false
      },
      onConfirm: vi.fn(),
      onSecondaryConfirm: vi.fn()
    }));

    expect(screen.queryByRole('button', { name: 'Claim & Restake' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull();
    expect(screen.queryByTestId('transaction-chain-guard-switch')).not.toBeNull();
  });

  it('an empty supportedChainIds opts out of the guard (chain-agnostic flows)', () => {
    mockChainId = 8453;
    const onConfirm = vi.fn();
    renderModal(() => ({
      title: 'Chain-agnostic',
      usdValue: 0,
      supportedChainIds: [],
      entry: { content: <div>fields</div>, confirmLabel: 'Confirm', confirmDisabled: false },
      onConfirm
    }));

    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('re-guards when the wallet switches to an unsupported chain WHILE the modal is open', () => {
    mockChainId = 1; // starts supported
    const onConfirm = vi.fn();
    renderTestTree(() => mainnetOnlyConfig(onConfirm));

    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();

    // The wallet moves to Base under the open modal (the exact APP-528 scenario):
    // flip the mocked chain and force the tree to re-render so the provider reads it.
    act(() => {
      mockChainId = 8453;
      forceRerender();
    });

    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.queryByTestId('transaction-chain-guard-switch')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes the failure view when the wallet switches: Retry never fires against the new chain', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let cb!: TxCallbacks;
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return mainnetOnlyConfig(onConfirm);
      },
      { onReady: a => (api = a) }
    );

    // The write starts on mainnet and the wallet rejects it — the modal sits on
    // its failure view (ERROR).
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => {
      cb.onMutate();
      cb.onError(new Error('User rejected the request'));
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();

    act(() => {
      mockChainId = 8453;
      forceRerender();
    });

    // Retry would fire the mainnet calls on Base: the session is gone instead.
    // (And with it the reason the route guard was holding its redirect — the
    // module's page is free to leave for Portfolio now.)
    expect(api.isModalOpen).toBe(false);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // The report that motivated the close: Savings and Convert run on several
  // chains, so a wallet moved from mainnet to Base under a failed write is on
  // a SUPPORTED chain and the guard has nothing to say — yet Retry then fired
  // the mainnet calls (Convert) or a "not ready" no-op (Savings).
  it('closes a multi-chain flow too when the wallet moves between two of its supported chains after a failure', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let cb!: TxCallbacks;
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return {
          title: 'Supply to Savings',
          usdValue: 0,
          supportedChainIds: [1, 8453, 42161],
          entry: { content: <div>fields</div>, confirmLabel: 'Confirm', confirmDisabled: false },
          onConfirm
        };
      },
      { onReady: a => (api = a) }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    act(() => {
      cb.onMutate();
      cb.onError(new Error('User rejected the request'));
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();

    act(() => {
      mockChainId = 8453; // Base: supported, so the guard stays silent
      forceRerender();
    });

    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    expect(api.isModalOpen).toBe(false);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // The only thing telling the user why the modal vanished.
    expect(lastToastText()).toContain('Transaction closed');
  });

  // A disconnect is not a switch. `guardChainId` falls back to the config
  // chain without a wallet, which for a wallet parked on an unconfigured chain
  // reads as a move — the session must not close over it with a toast that
  // says the wallet switched.
  it('does NOT close when the wallet disconnects at ERROR', () => {
    mockChainId = 1;
    mockConnectedChainId = 137; // Polygon: unconfigured, so the fallback differs
    let cb!: TxCallbacks;
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return {
          title: 'Chain-agnostic',
          usdValue: 0,
          supportedChainIds: [],
          entry: { content: <div>fields</div>, confirmLabel: 'Confirm', confirmDisabled: false },
          onConfirm: vi.fn()
        };
      },
      { onReady: a => (api = a) }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    act(() => {
      cb.onMutate();
      cb.onError(new Error('boom'));
    });
    toastWithCloseMock.mockClear();

    act(() => {
      mockConnectedChainId = undefined;
      mockAddress = undefined;
      forceRerender();
    });

    expect(api.isModalOpen).toBe(true);
    expect(toastWithCloseMock).not.toHaveBeenCalled();
  });

  // Before any write the switch is legitimate: the entry rebuilds for the new
  // chain (Savings' own network dropdown lives there), and a review is the
  // guard's to hold. Nothing has been built for a chain yet, so nothing closes.
  it('does NOT close at IDLE: a multi-chain entry follows the wallet to another supported chain', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      () => ({
        title: 'Supply to Savings',
        usdValue: 0,
        supportedChainIds: [1, 8453, 42161],
        entry: { content: <div>fields</div>, confirmLabel: 'Confirm', confirmDisabled: false },
        onConfirm
      }),
      { onReady: a => (api = a) }
    );

    act(() => {
      mockChainId = 8453;
      forceRerender();
    });

    expect(api.isModalOpen).toBe(true);
    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // A switch while the wallet prompt is up cannot close anything: the prompt
  // must settle. Once it settles as a failure the session ends; a success
  // closes itself.
  it('defers the close while a write is in flight, then closes when it settles as a failure', () => {
    mockChainId = 1;
    let cb!: TxCallbacks;
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return {
          title: 'Supply to Savings',
          usdValue: 0,
          supportedChainIds: [1, 8453, 42161],
          entry: { content: <div>fields</div>, confirmLabel: 'Confirm', confirmDisabled: false },
          onConfirm: vi.fn()
        };
      },
      { onReady: a => (api = a) }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    act(() => cb.onMutate()); // INITIALIZED: the wallet is showing the request
    act(() => {
      mockChainId = 8453;
      forceRerender();
    });
    expect(api.isModalOpen).toBe(true);

    act(() => cb.onError(new Error('User rejected the request')));
    expect(api.isModalOpen).toBe(false);
  });

  it('a gate verdict resolving after the wallet moved to an unsupported chain does NOT start the write', async () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    // An async gate (the screening call / signature prompt shape): it holds
    // the floor, then allows.
    const gate: PreTransactionGate = () => new Promise(resolve => (resolveVerdict = resolve));
    renderTestTree(() => mainnetOnlyConfig(onConfirm), { gate });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).not.toHaveBeenCalled();

    // The wallet switches while the verdict is pending…
    act(() => {
      mockChainId = 8453;
      forceRerender();
    });
    // …so the allow must not fire the executor, which by now builds Base calldata.
    await act(async () => {
      resolveVerdict({ allow: true });
    });
    expect(onConfirm).not.toHaveBeenCalled();
    // And the user isn't stranded on the transaction screen: back on the
    // first screen, guarded, with the switch offered.
    expect(screen.queryByTestId('transaction-chain-guard')).not.toBeNull();
    expect(screen.queryByTestId('transaction-chain-guard-switch')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });

  it('a guarded two-action entry shows no loading spinner while screening is pending, and the screening is told nothing is actionable', () => {
    mockChainId = 8453;
    const contexts: Array<{ active: boolean; actionable: boolean }> = [];
    const usePreflight: PreflightHook = context => {
      contexts.push(context);
      return { kind: 'pending' };
    };
    renderTestTree(
      () => ({
        title: 'Claim & Restake',
        usdValue: 300_000,
        supportedChainIds: [1, 314310],
        entry: {
          content: <div>fields</div>,
          confirmLabel: 'Claim & Restake',
          confirmDisabled: false,
          secondaryConfirmLabel: 'Claim',
          secondaryConfirmDisabled: false
        },
        onConfirm: vi.fn(),
        onSecondaryConfirm: vi.fn()
      }),
      { usePreflight }
    );

    // The flow's CTAs are replaced by the switch; the screening's pending
    // state must not leak a dots loader into it.
    expect(screen.queryByRole('button', { name: 'Claim' })).toBeNull();
    const switchBtn = screen.getByTestId('transaction-chain-guard-switch');
    expect(switchBtn.querySelector('[data-testid="loader"]')).toBeNull();
    expect((switchBtn as HTMLButtonElement).disabled).toBe(false);
    // The guard is folded into `actionable`, so no screening call is spent on
    // a transaction that cannot fire (only the live session's reads count —
    // before launch there is no config to guard).
    const live = contexts.filter(c => c.active);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every(c => c.actionable === false)).toBe(true);
  });
});

// The fallback layers behind the first-screen guard (review 5046511631).
describe('TransactionProvider — chain guard fallbacks', () => {
  it('a pre-write refusal (the batch backstop) lands on ERROR even after an earlier session wrote', () => {
    mockChainId = 1;
    let cb!: TxCallbacks;
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return mainnetOnlyConfig(vi.fn());
      },
      { onReady: a => (api = a) }
    );

    // Session 1 writes (latching writeGenRef) and fails; the user closes it.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    act(() => {
      cb.onMutate();
      cb.onError(new Error('User rejected the request'));
    });
    fireEvent.click(screen.getByTestId('transaction-modal-close'));

    // Session 2: the engine refuses BEFORE sendCalls — no onMutate, no hash.
    act(() => api.launch(mainnetOnlyConfig(vi.fn())));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    act(() => cb.onError(new Error('A batch transaction has a call with no target address')));

    // The refusal is this session's: it lands on the failure view, not on a
    // silent "Preparing" (the stale-write test used to drop it).
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });

  it('a multi-step failure closes on a wallet switch (the inline "Try again" is never a dead click)', () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let cb!: TxCallbacks;
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return { ...mainnetOnlyConfig(onConfirm), steps: ['Approve', 'Supply'] };
      },
      { onReady: a => (api = a) }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => {
      cb.onMutate();
      cb.onError(new Error('boom'));
    });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();

    act(() => {
      mockChainId = 8453;
      forceRerender();
    });
    expect(api.isModalOpen).toBe(false);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // The pending-verdict window between two SUPPORTED chains: the guard's
  // re-check passes (Base is fine for Savings), but the click was made on
  // mainnet and the form has since rebuilt for Base — the verdict must not
  // fire the click's action; the first screen re-derives instead.
  it('a gate verdict resolving after the wallet moved to ANOTHER supported chain does NOT start the write, and says so', async () => {
    mockChainId = 1;
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    // Async on the first click (the screening / signature shape), then a
    // plain allow so the re-click below is observable.
    let verdicts = 0;
    const gate: PreTransactionGate = () =>
      verdicts++ === 0 ? new Promise(resolve => (resolveVerdict = resolve)) : { allow: true };
    renderTestTree(
      () => ({
        title: 'Supply to Savings',
        usdValue: 0,
        supportedChainIds: [1, 8453, 42161],
        entry: {
          content: <div data-testid="entry-body">fields</div>,
          confirmLabel: 'Confirm',
          confirmDisabled: false
        },
        onConfirm
      }),
      { gate }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).not.toHaveBeenCalled();
    toastWithCloseMock.mockClear();

    act(() => {
      mockChainId = 8453;
      forceRerender();
    });
    await act(async () => {
      resolveVerdict({ allow: true });
    });
    expect(onConfirm).not.toHaveBeenCalled();
    // The guard has nothing to say (Base is supported), so the toast explains
    // the click that went nowhere.
    expect(screen.queryByTestId('transaction-chain-guard')).toBeNull();
    expect(lastToastText()).toContain('Network changed');
    // Back on the first screen, whose Confirm now fires for Base.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// Modals don't survive app navigation: the shell reports every pathname change
// and the provider closes the session unless something is at stake.
describe('TransactionProvider — idle sessions close on navigation', () => {
  // happy-dom's location: the pathname `launch` records for the session.
  const launchedAt = () => window.location.pathname;

  it('closes an idle session when the route changes', () => {
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(() => mainnetOnlyConfig(vi.fn()), { onReady: a => (api = a) });
    expect(api.isModalOpen).toBe(true);

    act(() => api.closeOnNavigation('/portfolio'));
    expect(api.isModalOpen).toBe(false);
  });

  it('keeps a session the destination page itself launched (same pathname)', () => {
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(() => mainnetOnlyConfig(vi.fn()), { onReady: a => (api = a) });

    act(() => api.closeOnNavigation(launchedAt()));
    expect(api.isModalOpen).toBe(true);
  });

  it('keeps an in-flight session (the wallet prompt / broadcast must settle)', () => {
    let api!: ReturnType<typeof useTransaction>;
    let cb!: TxCallbacks;
    renderTestTree(
      liveCb => {
        cb = liveCb;
        return mainnetOnlyConfig(vi.fn());
      },
      { onReady: a => (api = a) }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    act(() => cb.onMutate());

    act(() => api.closeOnNavigation('/portfolio'));
    expect(api.isModalOpen).toBe(true);
  });

  it('keeps a minimized session (minimize exists to move around the app)', () => {
    let api!: ReturnType<typeof useTransaction>;
    renderTestTree(() => mainnetOnlyConfig(vi.fn()), { onReady: a => (api = a) });
    act(() => api.minimize());
    expect(api.isMinimized).toBe(true);

    act(() => api.closeOnNavigation('/portfolio'));
    expect(api.isModalOpen).toBe(true);
    expect(api.isMinimized).toBe(true);
  });
});

// Forces a re-render of the provider subtree so a changed `mockChainId`
// propagates into the provider (which reads it via the mocked useChainId — a
// plain mock isn't reactive, so a real wallet chain change is simulated by
// flipping the value and re-rendering). The provider tree is rendered directly
// here (not via `children`) so bumping state actually re-invokes it.
let forceRerender: () => void = () => {};

type ProviderOptions = {
  gate?: PreTransactionGate;
  usePreflight?: PreflightHook;
  onReady?: (api: ReturnType<typeof useTransaction>) => void;
};

function RerenderHost({
  build,
  options
}: {
  build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig;
  options?: ProviderOptions;
}) {
  const [, bump] = useState(0);
  // Assigned in an effect (not during render) so the module-level handle is a
  // side effect that runs after mount — by the time the test calls it, it's set.
  useEffect(() => {
    forceRerender = () => bump(n => n + 1);
  }, []);
  return (
    <TransactionProvider gate={options?.gate} usePreflight={options?.usePreflight}>
      <Harness build={build} onReady={options?.onReady ?? (() => {})} />
    </TransactionProvider>
  );
}

function renderTestTree(
  build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig,
  options?: ProviderOptions
) {
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <RerenderHost build={build} options={options} />
      </I18nProvider>
    </StrictMode>
  );
}
