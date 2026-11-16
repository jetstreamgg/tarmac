import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';
import type { TransactionContextValue, TxCallbacks } from './transactionContract';

// The wallet moves to another chain the flow supports while a step mines. The
// next step must never be sent there, and the session must end telling the
// user why. Real TransactionProvider, modal and engine; wagmi is mocked.

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    handleSwitchChain: vi.fn(),
    isSwitchPending: false,
    switchVariables: undefined,
    canSwitchChain: true
  })
}));

const ETHEREUM = 1;
const BASE = 8453;

const wagmi = vi.hoisted(() => ({
  onMutate: undefined as undefined | ((variables?: unknown) => void),
  onWriteSuccess: undefined as undefined | ((hash: `0x${string}`, variables?: unknown) => void),
  writeContract: (() => {}) as (...args: unknown[]) => void,
  resetWrite: (() => {}) as () => void,
  walletChainId: 1,
  // The chain each sent request went on.
  sentOn: [] as number[],
  mutationHash: undefined as `0x${string}` | undefined,
  receipt: { isLoading: false, isSuccess: false, failure: null as Error | null }
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => wagmi.walletChainId,
  useChains: () => [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ],
  useConnection: () => ({
    connector: undefined,
    address: '0x0000000000000000000000000000000000000001',
    chainId: wagmi.walletChainId,
    isConnected: true
  }),
  // Like wagmi: the request carries the chain it was asked for, if any.
  useSimulateContract: (params: { functionName?: string; chainId?: number }) => {
    const request = { functionName: params.functionName, chainId: params.chainId };
    return { data: { request }, isLoading: false, error: null, refetch: async () => ({ data: { request } }) };
  },
  useWriteContract: (opts: {
    mutation: {
      onMutate?: (v?: unknown) => void;
      onSuccess?: (hash: `0x${string}`, v?: unknown) => void;
    };
  }) => {
    wagmi.onMutate = opts.mutation.onMutate;
    wagmi.onWriteSuccess = opts.mutation.onSuccess;
    return {
      writeContract: wagmi.writeContract,
      error: null,
      data: wagmi.mutationHash,
      variables: undefined,
      isPending: false,
      reset: wagmi.resetWrite
    };
  }
}));

vi.mock('@/hooks/shared/useTransactionOutcome', async io => ({
  ...(await io<typeof import('@/hooks/shared/useTransactionOutcome')>()),
  useTransactionOutcome: ({ hash }: { hash?: string }) => ({
    isPending: !!hash && wagmi.receipt.isLoading,
    isSuccess: !!hash && wagmi.receipt.isSuccess,
    failure: hash ? wagmi.receipt.failure : null,
    receipt: undefined
  })
}));
vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));

vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: false })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackWidgetReviewViewed: vi.fn(),
    trackTransactionStarted: vi.fn(),
    trackTransactionCompleted: vi.fn(),
    trackTermsSignatureDeclined: vi.fn()
  })
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: toastWithCloseMock
}));

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
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import { TxStatus } from '@/modules/ui/lib/txStatus';

i18n.load('en', {});
i18n.activate('en');

const makeCall = (functionName: string) =>
  ({ to: '0x0000000000000000000000000000000000000001', abi: [], functionName, args: [] }) as unknown as Call;
const CALLS: Call[] = [makeCall('approve'), makeCall('supply')];

type CallerChain = () => number;

// A flow that lives on both chains (like Savings) hosting the engine.
function Host({
  callerChain,
  onReady
}: {
  callerChain: CallerChain;
  onReady: (ctx: TransactionContextValue & { launchFlow: () => void }) => void;
}) {
  const ctx = useTransaction();
  const cbRef = useRef<TxCallbacks>(ctx.txCallbacks);
  useEffect(() => {
    cbRef.current = ctx.txCallbacks;
  });
  const flow = useSequentialTransactionFlow({
    calls: CALLS,
    chainId: callerChain(),
    onMutate: v => cbRef.current.onMutate(v),
    onStart: hash => cbRef.current.onStart(hash),
    onSuccess: (hash, blockNumber) => cbRef.current.onSuccess(hash, blockNumber),
    onError: (err, hash) => cbRef.current.onError(err, hash)
  });
  const execRef = useRef(flow.execute);
  useEffect(() => {
    execRef.current = flow.execute;
  });
  useEffect(() => {
    onReady({
      ...ctx,
      launchFlow: () =>
        ctx.launch({
          title: 'Supply',
          usdValue: 0,
          supportedChainIds: [ETHEREUM, BASE],
          steps: ['Approve', 'Supply'],
          sessionId: 'supply-session',
          onConfirm: () => execRef.current(),
          onRetry: () => execRef.current()
        })
    });
  });
  return (
    <div>
      <span data-testid="status">{ctx.txStatus}</span>
      <span data-testid="session">{ctx.activeSessionId ?? 'none'}</span>
    </div>
  );
}

function renderScenario(callerChain: CallerChain) {
  let api!: TransactionContextValue & { launchFlow: () => void };
  const tree = () => (
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Host callerChain={callerChain} onReady={a => (api = a)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  const r = render(tree());
  return { api: () => api, rerender: () => r.rerender(tree()) };
}

type Scenario = ReturnType<typeof renderScenario>;

const status = () => screen.getByTestId('status').textContent;
const session = () => screen.getByTestId('session').textContent;
const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => {});
};
const writes = () => (wagmi.writeContract as ReturnType<typeof vi.fn>).mock.calls;
const sent = () =>
  writes().map(([request], i) => `${(request as { functionName: string }).functionName}@${wagmi.sentOn[i]}`);
const lastToastText = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
  const { container, unmount } = render(<I18nProvider i18n={i18n}>{renderFn('toast')}</I18nProvider>);
  const text = container.textContent;
  unmount();
  return text;
};

// Launch, Confirm on Ethereum, the approve is signed and mining.
function driveToLoading(s: Scenario) {
  act(() => s.api().launchFlow());
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  expect(writes()).toHaveLength(1);
  const request = writes()[0][0];
  act(() => wagmi.onMutate?.(request));
  act(() => {
    wagmi.mutationHash = '0xapprove';
    wagmi.receipt = { isLoading: true, isSuccess: false, failure: null };
    wagmi.onWriteSuccess?.('0xapprove', request);
  });
  s.rerender();
  expect(status()).toBe(TxStatus.LOADING);
}

async function switchWallet(s: Scenario, chainId: number) {
  wagmi.walletChainId = chainId;
  s.rerender();
  await flush();
}

async function mineApprove(s: Scenario) {
  act(() => {
    wagmi.receipt = { isLoading: false, isSuccess: true, failure: null };
  });
  s.rerender();
  await flush();
}

describe('the wallet switches to another supported chain while a step mines', () => {
  beforeEach(() => {
    // Like wagmi: a request that names no chain goes on the wallet's.
    wagmi.writeContract = vi.fn((request: { chainId?: number }) => {
      wagmi.sentOn.push(request.chainId ?? wagmi.walletChainId);
    }) as never;
    wagmi.sentOn = [];
    wagmi.resetWrite = vi.fn();
    wagmi.walletChainId = ETHEREUM;
    wagmi.mutationHash = undefined;
    wagmi.receipt = { isLoading: false, isSuccess: false, failure: null };
  });
  afterEach(() => vi.clearAllMocks());

  it('sends the next step on the starting chain when the wallet stays', async () => {
    const s = renderScenario(() => ETHEREUM);
    driveToLoading(s);
    await mineApprove(s);

    expect(sent()).toEqual(['approve@1', 'supply@1']);
  });

  for (const [label, callerChain] of [
    ['a caller that names the starting chain', () => ETHEREUM],
    ['a caller that follows the wallet', () => wagmi.walletChainId]
  ] as const) {
    describe(label, () => {
      it('sends nothing on the new chain and ends the session with a notice', async () => {
        const s = renderScenario(callerChain);
        driveToLoading(s);
        await switchWallet(s, BASE);
        await mineApprove(s);

        expect(sent()).toEqual(['approve@1']);
        expect(session()).toBe('none');
        expect(lastToastText()).toContain('Transaction closed');
      });

      it('does the same for a minimized session', async () => {
        const s = renderScenario(callerChain);
        driveToLoading(s);
        act(() => s.api().minimize());
        await switchWallet(s, BASE);
        await mineApprove(s);

        expect(sent()).toEqual(['approve@1']);
        expect(session()).toBe('none');
        expect(lastToastText()).toContain('Transaction closed');
      });

      it('sends nothing either when the wallet comes back after the step mined', async () => {
        const s = renderScenario(callerChain);
        driveToLoading(s);
        await switchWallet(s, BASE);
        await mineApprove(s);
        await switchWallet(s, ETHEREUM);

        expect(sent()).toEqual(['approve@1']);
        expect(session()).toBe('none');
      });
    });
  }
});
