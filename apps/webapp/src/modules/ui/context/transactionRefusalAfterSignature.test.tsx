// A send refused right after the signature prelude (APP-664): the status is
// still the gate's INITIALIZED, and the refusal belongs on the send step.
import { StrictMode, useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import type { PreTransactionGate } from './preTransactionGate';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';

// Same stubs as transactionFailure.test.tsx: the real provider and modal, inert chain/wallet/analytics.
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    handleSwitchChain: vi.fn(),
    isSwitchPending: false,
    switchVariables: undefined,
    canSwitchChain: true
  })
}));
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }],
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001', isConnected: true })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: false })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));
const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn(),
  trackTermsSignatureDeclined: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({ useAppAnalytics: () => analytics }));
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: toastWithCloseMock
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
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

i18n.load('en', {});
i18n.activate('en');

const REASON = 'CCTP is paused.';
const walletRejection = () => Object.assign(new Error('User rejected the request.'), { code: 4001 });

let api!: ReturnType<typeof useTransaction>;
function Harness() {
  const transaction = useTransaction();
  useEffect(() => {
    api = transaction;
  });
  return null;
}
const cb = (): TxCallbacks => api.txCallbacks;
const ANALYTICS = { widgetName: 'w', flow: 'f' };

// The terms gate: owes a signature when asked to, and holds it until `sign` or `decline`.
const signature = { owed: false, sign: () => {}, decline: () => {} };
const gate: PreTransactionGate = ({ controls }) => {
  if (!signature.owed) {
    controls.setPreludeSteps(null);
    return { allow: true };
  }
  controls.setPreludeSteps([{ label: 'Sign terms', kind: 'signature', description: 'Sign in your wallet' }]);
  controls.setGateStatus('signature');
  return new Promise(resolve => {
    signature.sign = () => resolve({ allow: true });
    signature.decline = () => {
      controls.setGateStatus('error');
      resolve({ allow: false });
    };
  });
};

const mount = () =>
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider gate={gate}>
          <Harness />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
const launch = (config: Partial<TransactionConfig> = {}) =>
  act(() =>
    api.launch({
      title: 'Bridge',
      usdValue: 0,
      supportedChainIds: [1],
      steps: ['Send USDS'],
      onConfirm: () => {},
      ...config
    })
  );
const confirm = async () => {
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  await act(async () => {});
};
const sign = async () => {
  await act(async () => signature.sign());
};
const writeOneTransaction = async () => {
  launch();
  await confirm();
  act(() => cb().onMutate());
  act(() => cb().onStart('0xearlier'));
  act(() => cb().onSuccess('0xearlier'));
  await act(async () => {});
};

const hasText = (text: string) => screen.queryAllByText(content => content.includes(text)).length > 0;
const retryButton = () => screen.queryByRole('button', { name: /^(retry|try again)$/i });

describe('a send refused right after the signature prelude', () => {
  beforeEach(() => {
    i18n.activate('en');
    signature.owed = false;
  });
  afterEach(() => vi.clearAllMocks());

  const expectRefusedOnTheSendStep = () => {
    expect(hasText('Send USDS not sent')).toBe(true);
    expect(hasText(REASON)).toBe(true);
    expect(hasText('Nothing was sent.')).toBe(true);
    expect(hasText('Sign terms failed')).toBe(false);
    expect(hasText('Signature failed')).toBe(false);
    expect(hasText('Transaction not sent')).toBe(true);
  };

  it('shows on the send step when an earlier session on the page wrote, instead of hanging', async () => {
    mount();
    await writeOneTransaction();
    signature.owed = true;
    launch({ onConfirm: () => cb().onError(new TransactionRefusedError(REASON), '') });
    await confirm();
    await sign();
    expectRefusedOnTheSendStep();
    expect(retryButton()).not.toBeNull();
  });

  it('shows on the send step in a first session, with no Retry when it is final', async () => {
    mount();
    signature.owed = true;
    launch({ onConfirm: () => cb().onError(new TransactionRefusedError(REASON, { final: true })) });
    await confirm();
    await sign();
    expectRefusedOnTheSendStep();
    expect(retryButton()).toBeNull();
  });

  it('collapses a bundled flow to its failed summary, with the signature completed', async () => {
    mount();
    signature.owed = true;
    launch({
      bundled: true,
      steps: ['Approve', 'Send USDS'],
      onConfirm: () => cb().onError(new TransactionRefusedError(REASON), '')
    });
    await confirm();
    await sign();
    expect(hasText(REASON)).toBe(true);
    expect(hasText('Sign terms failed')).toBe(false);
    expect(hasText('Signature failed')).toBe(false);
    expect(retryButton()).not.toBeNull();
  });

  it('gets a row of its own in a flow launched without steps', async () => {
    mount();
    signature.owed = true;
    launch({ steps: undefined, onConfirm: () => cb().onError(new TransactionRefusedError(REASON), '') });
    await confirm();
    await sign();
    expect(hasText(REASON)).toBe(true);
    expect(hasText('Sign terms failed')).toBe(false);
    expect(retryButton()).not.toBeNull();
  });

  it('reports no transaction: none started, so none completes', async () => {
    mount();
    signature.owed = true;
    launch({
      analytics: ANALYTICS,
      onConfirm: () =>
        cb().onError(new Error('Refusing to send a batch before its simulation has completed.'), '')
    });
    await confirm();
    await sign();
    expect(analytics.trackTransactionStarted).not.toHaveBeenCalled();
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
    expect(hasText('Nothing was sent.')).toBe(true);
  });

  it('Retry sends again on the flow’s own steps once the signature is on record', async () => {
    mount();
    signature.owed = true;
    let refuse = true;
    const onConfirm = vi.fn(() => {
      if (refuse) cb().onError(new TransactionRefusedError(REASON), '');
      else cb().onMutate();
    });
    launch({ onConfirm });
    await confirm();
    await sign();
    expect(hasText('Send USDS not sent')).toBe(true);

    signature.owed = false;
    refuse = false;
    fireEvent.click(retryButton()!);
    await act(async () => {});
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(hasText('Send USDS not sent')).toBe(false);
    expect(hasText('Send USDS')).toBe(true);
    expect(hasText('Sign terms')).toBe(false);
  });

  it('a Retry that owes the signature again and is refused stays on the send step', async () => {
    mount();
    signature.owed = true;
    launch({ onConfirm: () => cb().onError(new TransactionRefusedError(REASON), '') });
    await confirm();
    await sign();
    fireEvent.click(retryButton()!);
    await act(async () => {});
    await sign();
    expectRefusedOnTheSendStep();
  });

  it('a Retry that owes the signature again waits on the signature row, and a decline fails that row', async () => {
    mount();
    signature.owed = true;
    launch({ onConfirm: () => cb().onError(new TransactionRefusedError(REASON), '') });
    await confirm();
    await sign();
    fireEvent.click(retryButton()!);
    await act(async () => {});
    expect(hasText('Sign in your wallet')).toBe(true);

    await act(async () => signature.decline());
    expect(hasText('Sign terms failed')).toBe(true);
    expect(hasText('Signature failed')).toBe(true);
    expect(hasText('rolled back')).toBe(false);
  });

  it('a Retry after a mined step that newly owes the signature is refused on the failed step', async () => {
    mount();
    let refuse = false;
    launch({
      steps: ['Approve', 'Send USDS'],
      onConfirm: () => {
        if (refuse) cb().onError(new TransactionRefusedError(REASON), '');
      }
    });
    await confirm();
    act(() => cb().onMutate());
    act(() => cb().onStart('0xapprove'));
    act(() => cb().onMutate());
    act(() => cb().onError(walletRejection(), ''));

    signature.owed = true;
    refuse = true;
    fireEvent.click(retryButton()!);
    await act(async () => {});
    await sign();
    expect(hasText('Send USDS not sent')).toBe(true);
    expect(hasText('Approve not sent')).toBe(false);
    expect(hasText(REASON)).toBe(true);
    // The approve went through.
    expect(hasText('Nothing was sent.')).toBe(false);
  });

  it('after the signature, the engine’s first write still takes over the status', async () => {
    mount();
    signature.owed = true;
    launch({ analytics: ANALYTICS, onConfirm: () => cb().onMutate() });
    await confirm();
    await sign();
    act(() => cb().onError(walletRejection(), ''));
    expect(hasText('Send USDS declined')).toBe(true);
    expect(hasText('Sign terms failed')).toBe(false);
    expect(analytics.trackTransactionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ txStatus: 'cancelled' })
    );
  });
});

describe('what stays out of the refusal path', () => {
  beforeEach(() => {
    i18n.activate('en');
    signature.owed = false;
  });
  afterEach(() => vi.clearAllMocks());

  const abandonThenOweSignature = async () => {
    mount();
    launch();
    await confirm();
    act(() => cb().onMutate());
    signature.owed = true;
    launch();
    await confirm();
  };

  it.each([
    { name: 'rejection', error: walletRejection() },
    { name: 'other failure', error: new Error('The RPC went away') }
  ])('an abandoned write’s $name during the pending signature is dropped', async ({ error }) => {
    await abandonThenOweSignature();
    act(() => cb().onError(error, ''));
    expect(hasText('failed')).toBe(false);
    expect(hasText('Sign in your wallet')).toBe(true);
  });

  it('an abandoned write’s rejection after a declined signature leaves the signature failed', async () => {
    await abandonThenOweSignature();
    await act(async () => signature.decline());
    act(() => cb().onError(walletRejection(), ''));
    expect(hasText('Sign terms failed')).toBe(true);
    expect(hasText('Signature failed')).toBe(true);
  });

  it('an abandoned write’s rejection after the signature, before the send, is dropped', async () => {
    await abandonThenOweSignature();
    await sign();
    act(() => cb().onError(walletRejection(), ''));
    expect(hasText('failed')).toBe(false);
    expect(hasText('declined')).toBe(false);
  });

  it('closing after the signature, before the send, abandons nothing', async () => {
    mount();
    signature.owed = true;
    launch({ analytics: ANALYTICS });
    await confirm();
    await sign();
    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0]);
    await act(async () => {});
    expect(analytics.trackTermsSignatureDeclined).not.toHaveBeenCalled();
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
    expect(toastWithCloseMock).not.toHaveBeenCalled();
  });
});
