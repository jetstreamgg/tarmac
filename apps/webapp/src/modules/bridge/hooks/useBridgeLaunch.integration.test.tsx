/**
 * @vitest-environment happy-dom
 */
import { StrictMode, useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAddress, parseEther, UserRejectedRequestError, type Address } from 'viem';
import { TransactionProvider } from '@/modules/ui/context/TransactionContext';
import { l1DepositBridge, type NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { applyProgress } from '../model/pendingTransitions';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeForm } from './useBridgeForm';
import { useBridgeLaunch } from './useBridgeLaunch';
import { nativeDepositFunction } from './useNativeDepositLegs';

// The real modal, form, launch, deposit legs and sequential engine; only the wallet and chain I/O is faked.
const SENDER = getAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
const OTHER = getAddress('0x2546BcD3c84621e976D8185a91A922aE77ECEc30');

type Write = {
  account: string | undefined;
  address: Address;
  functionName: string;
  args: readonly unknown[];
};
type Mutation = {
  onMutate?: (variables: unknown) => void;
  onSuccess?: (hash: `0x${string}`, variables: unknown) => void;
  onError?: (error: Error, variables: unknown) => void;
};
/** One wallet prompt: react-query keeps its options, refreshed only while it is the hook's current mutation. */
type Prompt = { variables: unknown; options: Mutation };

const env = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    version: 0,
    listeners,
    bump() {
      this.version++;
      listeners.forEach(listener => listener());
    },
    account: undefined as string | undefined,
    // Each wallet prompt the app opened, in order.
    writes: [] as Write[],
    // The mutation behind each prompt, aligned with `writes`.
    prompts: [] as Prompt[],
    current: undefined as Prompt | undefined,
    mutation: {} as Mutation,
    mutationHash: undefined as `0x${string}` | undefined,
    mined: new Set<string>(),
    reverted: new Set<string>(),
    // A receipt wait with viem's default timeout gives up on these hashes.
    timedOut: new Set<string>(),
    // The engine's receipt wait hits RPC errors on these hashes; it keeps watching.
    receiptFailed: new Set<string>(),
    // A hash sped up in the wallet, and its replacement.
    repriced: new Map<string, string>(),
    safe: false,
    // Inside the Safe App: the Safe transaction service maps a safeTxHash to the hash it executed under.
    safeApp: false,
    executed: {} as Record<string, string>,
    // A receipt wait rejects this many times with an RPC error before it polls.
    rpcErrors: {} as Record<string, number>,
    allowance: {} as Record<string, bigint>,
    // The allowance each owner last read, kept until a refetch (wagmi's 30 s staleTime).
    readAllowance: {} as Record<string, bigint>,
    // When set, the isOpen read before the wallet prompt waits for the test.
    holdIsOpen: false,
    pendingIsOpen: [] as ((value: bigint) => void)[]
  };
});

vi.mock('wagmi', async io => {
  const React = await import('react');
  const useEnv = () =>
    React.useSyncExternalStore(
      listener => {
        env.listeners.add(listener);
        return () => env.listeners.delete(listener);
      },
      () => env.version
    );
  const l1 = {
    readContract: ({ functionName }: { functionName: string }) => {
      if (functionName !== 'isOpen') return Promise.resolve(510_224_272_976n);
      if (!env.holdIsOpen) return Promise.resolve(1n);
      return new Promise<bigint>(resolve => env.pendingIsOpen.push(resolve));
    },
    getBlock: () => Promise.resolve({ baseFeePerGas: 2_000_000_000n }),
    waitForTransactionReceipt: ({
      hash: sent,
      timeout = 180_000,
      onReplaced
    }: {
      hash: string;
      timeout?: number;
      onReplaced?: (replacement: { reason: string; transaction: { hash: string } }) => void;
    }) =>
      new Promise((resolve, reject) => {
        if (env.rpcErrors[sent]) {
          env.rpcErrors[sent]--;
          return reject(new Error('HTTP request failed.'));
        }
        let hash = sent;
        const check = () => {
          const replacement = env.repriced.get(hash);
          if (replacement) {
            hash = replacement;
            onReplaced?.({ reason: 'repriced', transaction: { hash } });
          }
          if (timeout > 0 && env.timedOut.has(hash)) {
            env.listeners.delete(check);
            return reject(
              new Error(`Timed out while waiting for transaction with hash "${hash}" to be confirmed.`)
            );
          }
          const status = env.mined.has(hash) ? 'success' : env.reverted.has(hash) ? 'reverted' : undefined;
          if (!status) return;
          env.listeners.delete(check);
          resolve({ status, blockNumber: 1n, transactionHash: hash });
        };
        env.listeners.add(check);
        check();
      })
  };
  const l2 = {
    estimateContractGas: () => Promise.resolve(116_946n),
    estimateGas: () => Promise.resolve(116_946n),
    getGasPrice: () => Promise.resolve(10_000_000n)
  };
  const chains = [
    [1, 'Ethereum'],
    [8453, 'Base'],
    [10, 'OP Mainnet'],
    [42161, 'Arbitrum One'],
    [130, 'Unichain']
  ].map(([id, name]) => ({ id, name }));
  // One result per call, as wagmi's structural sharing keeps it.
  const simulations = new Map<string, unknown>();
  // Stable, like react-query's mutation reset.
  const resetWrite = () => {
    env.mutationHash = undefined;
    env.current = undefined;
  };
  const writeContract = (request: Omit<Write, 'account'>) => {
    const prompt = { variables: request, options: env.mutation };
    env.writes.push({ ...request, account: env.account });
    env.prompts.push(prompt);
    env.current = prompt;
    prompt.options.onMutate?.(request);
  };
  return {
    ...(await io<typeof import('wagmi')>()),
    useChainId: () => 1,
    useChains: () => chains,
    useConnection: () => {
      useEnv();
      return {
        address: env.account,
        isConnected: !!env.account,
        connector: env.account ? { id: env.safeApp ? 'safe' : 'injected' } : undefined
      };
    },
    // The L1 bridges' isOpen gate.
    useReadContract: () => ({ status: 'success', data: 1n }),
    usePublicClient: ({ chainId }: { chainId?: number }) => (chainId === 42161 ? l2 : l1),
    // Like wagmi: a disabled simulation with nothing cached for its call has no data and no error.
    useSimulateContract: (params: {
      address?: Address;
      functionName?: string;
      args?: readonly unknown[];
      query?: { enabled?: boolean };
    }) => {
      useEnv();
      const enabled = params.query?.enabled !== false && !!params.functionName;
      const { address, functionName, args } = params;
      const key = enabled ? `${address}:${functionName}:${String(args)}` : 'disabled';
      if (!simulations.has(key)) {
        const result = enabled
          ? { data: { request: { address, functionName, args } }, isLoading: false, error: null }
          : { data: undefined, isLoading: false, error: null };
        simulations.set(key, { ...result, refetch: () => Promise.resolve(result) });
      }
      return simulations.get(key);
    },
    useWriteContract: (opts: { mutation: Mutation }) => {
      useEnv();
      env.mutation = opts.mutation;
      if (env.current) env.current.options = opts.mutation;
      return {
        writeContract,
        error: null,
        data: env.mutationHash,
        variables: env.current?.variables,
        reset: resetWrite
      };
    }
  };
});
// The engine's receipt watcher: an RPC error keeps it watching, as useTransactionOutcome does.
vi.mock('@/hooks/shared/useTransactionOutcome', async io => {
  const React = await import('react');
  const actual = await io<typeof import('@/hooks/shared/useTransactionOutcome')>();
  return {
    ...actual,
    useTransactionOutcome: ({ hash }: { hash?: string }) => {
      React.useSyncExternalStore(
        listener => {
          env.listeners.add(listener);
          return () => env.listeners.delete(listener);
        },
        () => env.version
      );
      const mined = !!hash && env.mined.has(hash);
      const reverted = !!hash && env.reverted.has(hash);
      const failure = React.useMemo(
        () => (reverted ? new actual.TransactionRevertedError() : null),
        [reverted]
      );
      return {
        isPending: !!hash && !mined && !reverted,
        isSuccess: mined,
        failure,
        receipt: mined || reverted ? { blockNumber: 1n, transactionHash: hash } : undefined
      };
    }
  };
});
// The batch engine stays off: these runs are sequential.
vi.mock('@/hooks/shared/useSendBatchTransactionFlow', () => ({
  useSendBatchTransactionFlow: () => ({
    execute: vi.fn(),
    reset: vi.fn(),
    prepared: false,
    isLoading: false,
    error: null,
    currentCallIndex: 0,
    batchUnavailable: false
  })
}));
vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => env.safe,
  useIsBatchSupported: () => ({ data: false }),
  useAppChainId: () => 1,
  useNetworkFee: () => ({ data: undefined }),
  useTokenBalance: () => ({ data: { value: parseEther('1000') }, isLoading: false }),
  useTokenAllowance: ({ owner, contractAddress }: { owner?: string; contractAddress?: string }) => {
    const live = (key: string) => env.allowance[key] ?? 0n;
    if (owner && !(owner in env.readAllowance)) env.readAllowance[owner] = live(owner);
    return {
      data: contractAddress && owner ? env.readAllowance[owner] : undefined,
      error: null,
      mutate: () => {
        if (owner) env.readAllowance[owner] = live(owner);
        env.bump();
      }
    };
  }
}));
vi.mock('@/hooks/ui/useAppChainId', () => ({ useAppChainId: () => 1 }));
vi.mock('@/hooks/ui/useDebounce', () => ({ useDebounce: <T,>(value: T) => value }));
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    handleSwitchChain: vi.fn(),
    isSwitchPending: false,
    switchVariables: undefined,
    canSwitchChain: true
  })
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
vi.mock('@/components/ui/use-toast', () => ({ toast: { dismiss: vi.fn() }, toastWithClose: vi.fn() }));
// Every address is an EOA; the code check has its own tests in useBridgeForm.
vi.mock('./useAddressCode', () => ({ useAddressCode: () => ({ code: 'none', isChecking: false }) }));
vi.mock('../components/BridgeReviewContent', () => ({
  BridgeReviewContent: () => null,
  BridgeTransferHero: () => null
}));
// Render motion elements synchronously so the modal's transitions are deterministic.
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

const NETWORKS: NativeDepositNetwork[] = ['arbitrum', 'base', 'optimism', 'unichain'];
/** The network a wallet prompt sends to: the bridge it calls, or the bridge an approve lets spend. */
const networkOf = (write: Write): NativeDepositNetwork | undefined => {
  const target = write.functionName === 'approve' ? (write.args[0] as Address) : write.address;
  return NETWORKS.find(network => l1DepositBridge(network) === target);
};
const isDeposit = (write: Write) => write.functionName !== 'approve';

let bridge!: ReturnType<typeof useBridgeForm> extends infer F
  ? { form: F } & ReturnType<typeof useBridgeLaunch>
  : never;
function BridgeHost({ onRender }: { onRender: (value: typeof bridge) => void }) {
  const form = useBridgeForm();
  const launch = useBridgeLaunch(form);
  // The latest form and launch, as the Bridge tab reads them on its next click.
  useEffect(() => {
    onRender({ form, ...launch });
  });
  return null;
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await act(() => new Promise(resolve => setTimeout(resolve, 0)));
};

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <TransactionProvider>
            <BridgeHost onRender={value => void (bridge = value)} />
          </TransactionProvider>
        </QueryClientProvider>
      </I18nProvider>
    </StrictMode>
  );
}

const wallet = {
  /** Signs a prompt, the last one by default; only the hook's current mutation sets its data. */
  sign: async (hash: `0x${string}`, prompt = env.prompts.at(-1)) => {
    act(() => {
      if (prompt && prompt === env.current) env.mutationHash = hash;
      prompt?.options.onSuccess?.(hash, prompt.variables);
      env.bump();
    });
    await settle();
  },
  reject: async (prompt = env.prompts.at(-1)) => {
    act(() => {
      prompt?.options.onError?.(
        new UserRejectedRequestError(new Error('User rejected the request.')),
        prompt.variables
      );
      env.bump();
    });
    await settle();
  },
  mine: async (hash: string) => {
    act(() => {
      env.mined.add(hash);
      env.bump();
    });
    await settle();
  },
  switchAccount: async (account: string | undefined) => {
    act(() => {
      env.account = account;
      env.bump();
    });
    await settle();
  }
};

async function review(to: NativeDepositNetwork, amount = '25') {
  act(() => bridge.form.onInput(amount));
  act(() => bridge.form.selectTo(to));
  await settle();
  act(() => bridge.launch());
  await settle();
}
async function confirm() {
  fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
  await settle();
}
async function closeModal() {
  fireEvent.click(screen.getByTestId('transaction-modal-close'));
  await settle();
}

/** Signs and mines every prompt the run opens from here until its deposit leg is broadcast. */
async function completeRun(prefix: string): Promise<string | undefined> {
  for (let i = 0; i < 2; i++) {
    const prompt = env.writes.at(-1);
    if (!prompt) return undefined;
    const hash = `0x${prefix}${i}` as `0x${string}`;
    await wallet.sign(hash);
    if (isDeposit(prompt)) return hash;
    await wallet.mine(hash);
  }
  return undefined;
}

const scope = pendingScopeKey({ account: SENDER, familyChainId: 1 });

/** What executes is what was reviewed: every prompt since `from` and the card stored for the deposit name `network`. */
function expectSentAsReviewed(from: number, network: NativeDepositNetwork, depositHash: string | undefined) {
  const sent = env.writes.slice(from).map(write => ({ fn: write.functionName, to: networkOf(write) }));
  const card = pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.txHash === depositHash);
  expect(sent.length).toBeGreaterThan(0);
  expect({ sent, cardTo: card?.to }).toEqual({
    sent: sent.map(({ fn }) => ({ fn, to: network })),
    cardTo: network
  });
}

describe('a native deposit through the real modal and engine', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  beforeEach(() => {
    localStorage.clear();
    Object.assign(env, {
      account: SENDER,
      writes: [],
      prompts: [],
      current: undefined,
      mutation: {},
      mutationHash: undefined,
      mined: new Set<string>(),
      reverted: new Set<string>(),
      timedOut: new Set<string>(),
      receiptFailed: new Set<string>(),
      repriced: new Map<string, string>(),
      safe: false,
      safeApp: false,
      executed: {},
      rpcErrors: {},
      allowance: {},
      readAllowance: {},
      holdIsOpen: false,
      pendingIsOpen: []
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string | URL) => {
        const executed = Object.entries(env.executed).find(([safeTxHash]) =>
          String(url).includes(safeTxHash)
        )?.[1];
        return Promise.resolve(
          executed
            ? ({
                status: 200,
                ok: true,
                json: () => Promise.resolve({ transactionHash: executed })
              } as Response)
            : ({ status: 404, ok: false, json: () => Promise.resolve({}) } as Response)
        );
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('control: an uninterrupted Review sends to the network it shows and stores the card for it', async () => {
    renderApp();
    await review('arbitrum');
    await confirm();
    expect(env.writes.map(networkOf)).toEqual(['arbitrum']);
    expectSentAsReviewed(0, 'arbitrum', await completeRun('a'));
  });

  describe('a Confirm to Arbitrum abandoned at the wallet prompt, then a Review to Base', () => {
    it('the user closes the modal, then rejects in the wallet', async () => {
      renderApp();
      await review('arbitrum');
      await confirm();
      await closeModal();
      await wallet.reject();

      await review('base');
      const from = env.writes.length;
      await confirm();
      expectSentAsReviewed(from, 'base', await completeRun('b'));
    });

    it('the user closes the modal and the wallet prompt never settles', async () => {
      renderApp();
      await review('arbitrum');
      await confirm();
      await closeModal();

      await review('base');
      const from = env.writes.length;
      await confirm();
      expectSentAsReviewed(from, 'base', await completeRun('c'));
    });

    it('the user closes the modal while the bridge switch is read', async () => {
      env.holdIsOpen = true;
      renderApp();
      await review('arbitrum');
      await confirm();
      await closeModal();
      act(() => env.pendingIsOpen.shift()?.(1n));
      await settle();
      // Nothing reaches the wallet once the modal is closed.
      expect(env.writes).toEqual([]);

      env.holdIsOpen = false;
      await review('base');
      const from = env.writes.length;
      await confirm();
      expectSentAsReviewed(from, 'base', await completeRun('d'));
    });
  });

  it.each([
    ['switches to another account', OTHER],
    ['disconnects', undefined]
  ])(
    'the wallet %s after the approve: no leg is signed by another account, and the run fails instead of hanging',
    async (_, after) => {
      // The other account already lets the bridge spend, so its deposit would simulate.
      env.allowance[OTHER] = parseEther('1000');
      renderApp();
      await review('base');
      await confirm();
      expect(env.writes.map(write => write.functionName)).toEqual(['approve']);
      await wallet.sign('0xapprove');
      await wallet.switchAccount(after);
      await wallet.mine('0xapprove');

      // The modal can be closed again: the run ended on an error, not on Processing.
      expect(screen.getByTestId('transaction-modal-close').getAttribute('aria-label')).toBe('Close');
      // Retry from the new account doesn't send the Review that was opened for the old one.
      fireEvent.click(screen.getByRole('button', { name: /^(retry|try again)$/i }));
      await settle();
      expect(env.writes.map(write => ({ fn: write.functionName, account: write.account }))).toEqual([
        { fn: 'approve', account: SENDER }
      ]);
    }
  );

  it('the wallet switches to another account while the bridge switch is read: nothing is sent', async () => {
    env.allowance[OTHER] = parseEther('1000');
    env.holdIsOpen = true;
    renderApp();
    await review('base');
    await confirm();
    await wallet.switchAccount(OTHER);
    act(() => env.pendingIsOpen.shift()?.(1n));
    await settle();
    await completeRun('e');

    expect(env.writes).toEqual([]);
    expect(screen.getByTestId('transaction-modal-close').getAttribute('aria-label')).toBe('Close');
  });

  it('the wallet switches to another account while the approve prompt is open: no leg is signed by it', async () => {
    env.allowance[OTHER] = parseEther('1000');
    renderApp();
    await review('base');
    await confirm();
    await wallet.switchAccount(OTHER);
    await completeRun('f');

    expect(env.writes.filter(write => write.account !== SENDER)).toEqual([]);
    expect(screen.getByTestId('transaction-modal-close').getAttribute('aria-label')).toBe('Close');
  });

  describe('the wallet account changes after the deposit is broadcast: the modal follows it to its receipt', () => {
    async function broadcastDeposit(hash: `0x${string}`) {
      env.allowance[SENDER] = parseEther('1000');
      renderApp();
      await review('base');
      await confirm();
      await wallet.sign(hash);
      expect(pendingBridgeStore.getSnapshot(scope).map(bridge => bridge.txHash)).toEqual([hash]);
    }

    it.each([
      ['another account with an allowance', OTHER, parseEther('1000')],
      ['another account with no allowance', OTHER, 0n],
      ['no account', undefined, 0n]
    ])('to %s', async (_, account, allowance) => {
      await broadcastDeposit('0xr4dep');
      if (account) env.allowance[account] = allowance;
      await wallet.switchAccount(account);
      expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
      await wallet.mine('0xr4dep');

      expect(screen.queryByText('Review USDS bridge')).toBeNull();
      expect(env.writes).toHaveLength(1);
    });
  });

  it('the deposit reverts after its approve mined, then the wallet switches away and back: Retry sends the deposit', async () => {
    renderApp();
    await review('base');
    await confirm();
    await wallet.sign('0xpapprove');
    act(() => void (env.allowance[SENDER] = parseEther('1000')));
    await wallet.mine('0xpapprove');
    await wallet.sign('0xpdep');
    act(() => {
      env.reverted.add('0xpdep');
      env.bump();
    });
    await settle();
    await wallet.switchAccount(OTHER);
    await wallet.switchAccount(SENDER);

    const from = env.writes.length;
    fireEvent.click(screen.getByRole('button', { name: /^(retry|try again)$/i }));
    await settle();
    expect(env.writes.slice(from).map(write => write.functionName)).toEqual(['bridgeERC20To']);
  });

  it('the wallet switches to another account while the deposit prompt is open, then the old prompt is signed: the sent bridge is tracked and followed', async () => {
    env.allowance[OTHER] = parseEther('1000');
    renderApp();
    await review('base');
    await confirm();
    await wallet.sign('0xapprove');
    await wallet.mine('0xapprove');
    expect(env.writes.map(write => write.functionName)).toEqual(['approve', 'bridgeERC20To']);
    await wallet.switchAccount(OTHER);
    await wallet.sign('0xdeposit');

    expect(pendingBridgeStore.getSnapshot(scope).map(bridge => bridge.txHash)).toEqual(['0xdeposit']);
    expect(screen.queryByRole('button', { name: /^(retry|try again)$/i })).toBeNull();
    await wallet.mine('0xdeposit');
    expect(screen.queryByText('Review USDS bridge')).toBeNull();
    expect(env.writes).toHaveLength(2);
  });

  it('the modal closes with the Arbitrum deposit prompt open, then a Review to Base, then the old prompt is signed: the sent bridge is tracked as Arbitrum', async () => {
    renderApp();
    await review('arbitrum');
    await confirm();
    await wallet.sign('0xapprove');
    await wallet.mine('0xapprove');
    expect(env.writes.map(networkOf)).toEqual(['arbitrum', 'arbitrum']);
    await closeModal();
    await review('base');
    await wallet.sign('0xlatearbitrum');

    const card = pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.txHash === '0xlatearbitrum');
    expect(card?.to).toBe('arbitrum');
  });

  describe('the Arbitrum deposit prompt left open by closing the modal, then signed during a Confirm to Base', () => {
    const cards = () =>
      Object.fromEntries(pendingBridgeStore.getSnapshot(scope).map(bridge => [bridge.txHash, bridge.to]));
    async function abandonArbitrumDeposit(allowanceAfter = 0n) {
      renderApp();
      await review('arbitrum');
      await confirm();
      await wallet.sign('0xr3approve');
      await wallet.mine('0xr3approve');
      expect(env.writes.map(write => write.functionName)).toEqual([
        'approve',
        'outboundTransferCustomRefund'
      ]);
      const stale = env.prompts.at(-1);
      // Read again when the modal closes.
      env.allowance[SENDER] = allowanceAfter;
      await closeModal();
      return stale;
    }

    it.each([
      ['its approve prompt is open', 0n, 'r3a'],
      ['its deposit prompt is open', parseEther('1000'), 'r3d']
    ])('while %s: each bridge gets its own card for its own network', async (_, allowance, prefix) => {
      const stale = await abandonArbitrumDeposit(allowance);
      await review('base');
      const from = env.writes.length;
      await confirm();
      expect(env.writes.at(-1)?.functionName).toBe(allowance ? 'bridgeERC20To' : 'approve');
      await wallet.sign(`0x${prefix}late`, stale);
      const baseHash = await completeRun(prefix);

      expect(cards()).toMatchObject({ [`0x${prefix}late`]: 'arbitrum', [baseHash!]: 'base' });
      expectSentAsReviewed(from, 'base', baseHash);
    });

    it('with the Base approve prompt also abandoned: the late deposit still gets its Arbitrum card', async () => {
      const stale = await abandonArbitrumDeposit();
      await review('base');
      await confirm();
      const staleApprove = env.prompts.at(-1);
      await closeModal();
      await wallet.sign('0xr3twolate', stale);
      await wallet.sign('0xr3twoapprove', staleApprove);

      expect(cards()).toMatchObject({ '0xr3twolate': 'arbitrum' });
      expect(cards()).not.toHaveProperty('0xr3twoapprove');
    });

    it.each([
      ['approve', 0n],
      ['deposit', parseEther('1000')]
    ])(
      'signed after the Base %s prompt was rejected: Retry sends no deposit while the Arbitrum one is pending',
      async (_, allowance) => {
        const stale = await abandonArbitrumDeposit(allowance);
        await review('base');
        await confirm();
        await wallet.reject();
        const from = env.writes.length;
        await wallet.sign('0xr3f3late', stale);
        expect(cards()).toMatchObject({ '0xr3f3late': 'arbitrum' });
        fireEvent.click(screen.getByRole('button', { name: /^(retry|try again)$/i }));
        await settle();
        // Whatever the Retry opens is signed and mined.
        for (let i = 0; env.writes.length > from + i && i < 2; i++) {
          const hash = `0xr3f3retry${i}` as `0x${string}`;
          await wallet.sign(hash, env.prompts.at(-1));
          await wallet.mine(hash);
        }

        expect(env.writes.slice(from).filter(isDeposit)).toEqual([]);
      }
    );

    it('signed after the Base deposit prompt was rejected, then reverted: the next Review can send', async () => {
      const stale = await abandonArbitrumDeposit(parseEther('1000'));
      await review('base');
      await confirm();
      await wallet.reject();
      await wallet.sign('0xr3f3reverted', stale);
      // As the bridge tracker records the reverted receipt.
      act(() =>
        pendingBridgeStore.update(scope, '0xr3f3reverted', bridge =>
          applyProgress(bridge, { kind: 'failed', reason: 'source-tx-reverted' }, Date.now())
        )
      );
      await settle();
      await closeModal();
      await review('base');
      const from = env.writes.length;
      await confirm();

      expect(env.writes.slice(from).filter(isDeposit)).toHaveLength(1);
    });

    it('rejected late: the Base run keeps going and sends its deposit', async () => {
      const stale = await abandonArbitrumDeposit();
      await review('base');
      const from = env.writes.length;
      await confirm();
      await wallet.reject(stale);

      // No error screen for the Base run.
      expect(screen.queryByRole('button', { name: /^(retry|try again)$/i })).toBeNull();
      expectSentAsReviewed(from, 'base', await completeRun('r3r'));
    });
  });

  describe('a deposit prompt left open by a failed run, then signed after a Retry of the same Review', () => {
    const cards = () =>
      Object.fromEntries(pendingBridgeStore.getSnapshot(scope).map(bridge => [bridge.txHash, bridge.to]));
    const deposits = (from: number) => env.writes.slice(from).filter(isDeposit);
    const retry = async () => {
      fireEvent.click(screen.getByRole('button', { name: /^(retry|try again)$/i }));
      await settle();
    };
    /** Base Review: approve mined, deposit prompt open; switching away and back fails the run. */
    async function strandDepositPrompt(onRender?: (app: ReturnType<typeof renderApp>) => void) {
      const app = renderApp();
      onRender?.(app);
      await review('base');
      await confirm();
      await wallet.sign('0xs1approve');
      act(() => void (env.allowance[SENDER] = parseEther('1000')));
      await wallet.mine('0xs1approve');
      expect(env.writes.map(write => write.functionName)).toEqual(['approve', 'bridgeERC20To']);
      const stale = env.prompts.at(-1);
      await wallet.switchAccount(OTHER);
      await wallet.switchAccount(SENDER);
      return stale;
    }

    it("signed while the Retry's deposit prompt is open, which is rejected: no Retry is offered and nothing more is sent", async () => {
      const stale = await strandDepositPrompt();
      await retry();
      expect(env.writes.at(-1)?.functionName).toBe('bridgeERC20To');
      await wallet.sign('0xs1late', stale);
      expect(cards()).toMatchObject({ '0xs1late': 'base' });
      const from = env.writes.length;
      await wallet.reject();

      expect(screen.queryByRole('button', { name: /^(retry|try again)$/i })).toBeNull();
      expect(deposits(from)).toEqual([]);
    });

    it('signed while the Retry reads the bridge switch: no other deposit prompt opens', async () => {
      const stale = await strandDepositPrompt();
      env.holdIsOpen = true;
      await retry();
      const from = env.writes.length;
      await wallet.sign('0xs2late', stale);
      expect(cards()).toMatchObject({ '0xs2late': 'base' });
      act(() => env.pendingIsOpen.shift()?.(1n));
      await settle();

      expect(deposits(from)).toEqual([]);
    });

    it('signed while the Retry runs: the modal follows it to its receipt and shows no failure', async () => {
      const stale = await strandDepositPrompt();
      await retry();
      await wallet.sign('0xs4late', stale);
      expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
      await wallet.mine('0xs4late');

      expect(screen.queryByText('Review USDS bridge')).toBeNull();
    });

    it('signed after its run ended, with no Retry: the modal follows it to its receipt and shows no failure', async () => {
      const stale = await strandDepositPrompt();
      await wallet.sign('0xs5late', stale);
      expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
      await wallet.mine('0xs5late');

      expect(screen.queryByText('Review USDS bridge')).toBeNull();
    });

    it('signed after its run ended and pending past a receipt timeout: no failure is shown, then it is followed to its receipt', async () => {
      const stale = await strandDepositPrompt();
      await wallet.sign('0xs7late', stale);
      act(() => {
        env.timedOut.add('0xs7late');
        env.bump();
      });
      await settle();
      expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
      await wallet.mine('0xs7late');

      expect(screen.queryByText('Review USDS bridge')).toBeNull();
    });

    it('from a Safe, signed after its run ended and pending past a receipt timeout: no failure is shown', async () => {
      env.safe = true;
      const stale = await strandDepositPrompt();
      await wallet.sign('0xs8safetx', stale);
      expect(pendingBridgeStore.getSnapshot(scope).map(bridge => bridge.safeTxHash)).toContain('0xs8safetx');
      act(() => {
        env.timedOut.add('0xs8safetx');
        env.bump();
      });
      await settle();

      expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
    });

    it('inside the Safe App, signed after its run ended: the modal follows the hash it executed under', async () => {
      env.safe = true;
      const stale = await strandDepositPrompt();
      act(() => {
        env.safeApp = true;
        env.executed['0xs10safetx'] = '0xs10exec';
        env.bump();
      });
      await settle();
      await wallet.sign('0xs10safetx', stale);
      await wallet.mine('0xs10exec');

      await vi.waitFor(() => expect(screen.queryByText('Review USDS bridge')).toBeNull());
    });

    it('signed after its run ended, then one RPC error on its receipt: no failure is shown, then it is followed to its receipt', async () => {
      const stale = await strandDepositPrompt();
      env.rpcErrors['0xs11late'] = 1;
      await wallet.sign('0xs11late', stale);
      await settle();
      expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
      await wallet.mine('0xs11late');

      await vi.waitFor(() => expect(screen.queryByText('Review USDS bridge')).toBeNull(), { timeout: 3000 });
    });

    it('signed after its run ended, then RPC errors on its receipt for a while: no failure is shown, then it is followed to its receipt', async () => {
      const stale = await strandDepositPrompt();
      env.rpcErrors['0xs12late'] = 6;
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        await wallet.sign('0xs12late', stale);
        await act(() => vi.advanceTimersByTimeAsync(120_000));
        expect(document.body.textContent).not.toMatch(/failed|declined|rolled back/i);
        expect(env.rpcErrors['0xs12late']).toBe(0);
        await wallet.mine('0xs12late');
        await act(() => vi.advanceTimersByTimeAsync(60_000));
      } finally {
        vi.useRealTimers();
      }

      await vi.waitFor(() => expect(screen.queryByText('Review USDS bridge')).toBeNull(), { timeout: 3000 });
    });

    it('signed after its run ended, its receipt erroring, then the bridge unmounts: it stops polling and its card stays pending', async () => {
      let app!: ReturnType<typeof renderApp>;
      const stale = await strandDepositPrompt(rendered => (app = rendered));
      env.rpcErrors['0xs13late'] = 1_000;
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        await wallet.sign('0xs13late', stale);
        await act(() => vi.advanceTimersByTimeAsync(10_000));
        expect(env.rpcErrors['0xs13late']).toBeLessThan(1_000);
        app.unmount();
        // The backoff sleep under way when it unmounts ends in one more attempt at most.
        await act(() => vi.advanceTimersByTimeAsync(30_000));
        const left = env.rpcErrors['0xs13late'];
        await act(() => vi.advanceTimersByTimeAsync(300_000));
        expect(env.rpcErrors['0xs13late']).toBe(left);
      } finally {
        vi.useRealTimers();
      }

      expect(
        pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.txHash === '0xs13late')?.status
      ).toBe('pending');
    });

    it('signed after the Retry sent the bridge, then sped up in the wallet: its card follows the hash that mines', async () => {
      const stale = await strandDepositPrompt();
      await retry();
      await wallet.sign('0xs9retry');
      await wallet.mine('0xs9retry');
      await wallet.sign('0xs9late', stale);
      act(() => {
        env.repriced.set('0xs9late', '0xs9fast');
        env.bump();
      });
      await settle();

      expect(pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.id === '0xs9late')?.txHash).toBe(
        '0xs9fast'
      );
    });

    it('signed while the Retry runs, then reverted: Retry can send the bridge', async () => {
      const stale = await strandDepositPrompt();
      await retry();
      await wallet.sign('0xs6late', stale);
      act(() => {
        env.reverted.add('0xs6late');
        env.bump();
      });
      await settle();
      expect(pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.txHash === '0xs6late')?.status).toBe(
        'failed'
      );
      const from = env.writes.length;
      await retry();

      expect(deposits(from)).toHaveLength(1);
    });

    it('rejected late: the Retry run keeps going and sends its deposit', async () => {
      const stale = await strandDepositPrompt();
      await retry();
      const from = env.writes.length - 1;
      await wallet.reject(stale);

      expect(screen.queryByRole('button', { name: /^(retry|try again)$/i })).toBeNull();
      expectSentAsReviewed(from, 'base', await completeRun('s3'));
    });
  });

  describe('a deposit from a closed Review that settles while the next Review is open', () => {
    const statuses = () =>
      Object.fromEntries(pendingBridgeStore.getSnapshot(scope).map(bridge => [bridge.txHash, bridge.status]));
    const deposits = (from: number) => env.writes.slice(from).filter(isDeposit);
    const action = async () => {
      fireEvent.click(screen.getByRole('button', { name: /^(retry|try again|confirm)$/i }));
      await settle();
    };

    it('its prompt is signed before the new Review is confirmed: Confirm does not send it again', async () => {
      renderApp();
      await review('base');
      await confirm();
      await wallet.sign('0xc1approve');
      act(() => void (env.allowance[SENDER] = parseEther('1000')));
      await wallet.mine('0xc1approve');
      const stale = env.prompts.at(-1);
      await closeModal();
      await review('base');
      await wallet.sign('0xc1late', stale);
      expect(statuses()).toMatchObject({ '0xc1late': 'pending' });
      const from = env.writes.length;
      await action();

      expect(deposits(from)).toEqual([]);
    });

    /** Base Review: approve mined, deposit prompt open, the run failed by an account switch, then a Retry. */
    async function strandThenRetry() {
      renderApp();
      await review('base');
      await confirm();
      await wallet.sign('0xr1approve');
      act(() => void (env.allowance[SENDER] = parseEther('1000')));
      await wallet.mine('0xr1approve');
      const stale = env.prompts.at(-1);
      await wallet.switchAccount(OTHER);
      await wallet.switchAccount(SENDER);
      await action();
      expect(env.writes.at(-1)?.functionName).toBe('bridgeERC20To');
      return stale;
    }

    it('the closed Review was retried and left at its own prompt: Confirm does not send it again', async () => {
      const stale = await strandThenRetry();
      await closeModal();
      await review('base');
      await wallet.sign('0xr1late', stale);
      expect(statuses()).toMatchObject({ '0xr1late': 'pending' });
      const from = env.writes.length;
      await action();

      expect(deposits(from)).toEqual([]);
    });

    it("the closed Review's Retry was rejected: Confirm does not send it again", async () => {
      const stale = await strandThenRetry();
      await wallet.reject();
      await closeModal();
      await review('base');
      await wallet.sign('0xr2late', stale);
      expect(statuses()).toMatchObject({ '0xr2late': 'pending' });
      const from = env.writes.length;
      await action();

      expect(deposits(from)).toEqual([]);
    });

    it('it reverts: the new Review can send', async () => {
      env.allowance[SENDER] = parseEther('1000');
      renderApp();
      await review('base');
      await confirm();
      await wallet.sign('0xc2sent');
      await closeModal();
      await review('base');
      act(() => {
        env.reverted.add('0xc2sent');
        env.bump();
      });
      await settle();
      expect(statuses()).toMatchObject({ '0xc2sent': 'failed' });
      const from = env.writes.length;
      await action();

      expect(deposits(from)).toHaveLength(1);
    });
  });

  it.each(['arbitrum', 'base'] as const)(
    'a Safe over WalletConnect to %s whose receipt wait hits RPC errors before it executes: no Retry, and its card stays pending',
    async to => {
      env.safe = true;
      env.allowance[SENDER] = parseEther('1000');
      renderApp();
      await review(to);
      await confirm();
      await wallet.sign('0xwcsafetx');
      // The engine waits on the safeTxHash, which never mines; an RPC error does not end that wait.
      act(() => {
        env.receiptFailed.add('0xwcsafetx');
        env.bump();
      });
      await settle();
      expect(screen.queryByRole('button', { name: /^(retry|try again)$/i })).toBeNull();

      expect(env.writes.map(write => write.functionName)).toEqual([nativeDepositFunction(to)]);
      expect(pendingBridgeStore.getSnapshot(scope)).toMatchObject([
        { safeTxHash: '0xwcsafetx', to, status: 'pending' }
      ]);
    }
  );

  it('an approve that mined before an account switch is not asked for again after switching back', async () => {
    renderApp();
    await review('base');
    await confirm();
    await wallet.sign('0xapprove');
    act(() => void (env.allowance[SENDER] = parseEther('1000')));
    await wallet.mine('0xapprove');
    await wallet.switchAccount(OTHER);
    await closeModal();
    await wallet.switchAccount(SENDER);

    await review('base');
    const from = env.writes.length;
    await confirm();
    expect(env.writes.slice(from).map(write => write.functionName)).toEqual(['bridgeERC20To']);
  });

  it('Review clicked while disconnected after a sent deposit whose receipt wait failed, then reconnecting: the pending deposit is not sent again', async () => {
    env.allowance[SENDER] = parseEther('1000');
    renderApp();
    await review('base');
    await confirm();
    await wallet.sign('0xsent');
    act(() => {
      env.receiptFailed.add('0xsent');
      env.bump();
    });
    await settle();
    await wallet.switchAccount(undefined);
    await closeModal();
    const launchAtClick = bridge.launch;
    await wallet.switchAccount(SENDER);
    act(() => launchAtClick());
    await settle();
    // The engine keeps watching through an RPC error, so there is no Confirm to send again.
    expect(screen.queryByRole('button', { name: /^confirm$/i })).toBeNull();

    expect(env.writes.map(write => write.functionName)).toEqual(['bridgeERC20To']);
  });

  it('Review clicked while disconnected runs once the wallet connects, for the connected account', async () => {
    env.account = undefined;
    renderApp();
    act(() => bridge.form.onInput('25'));
    act(() => bridge.form.selectTo('base'));
    await settle();
    // Connect-then-act keeps the click-time launch and calls it after connecting.
    const launchAtClick = bridge.launch;
    await wallet.switchAccount(SENDER);
    act(() => launchAtClick());
    await settle();
    await confirm();

    expect(env.writes.map(write => ({ fn: write.functionName, account: write.account }))).toEqual([
      { fn: 'approve', account: SENDER }
    ]);
  });
});
