/**
 * @vitest-environment happy-dom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { TransactionNotFoundError, TransactionReceiptNotFoundError, type Hex } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { dismissedSourceStore } from '../store/dismissedSourceStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { useDismissedSourceWatch } from './useDismissedSourceWatch';

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const HASH = `0x${'d5'.repeat(32)}` as Hex;
const BRIDGE: PendingBridge = {
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
  startedAt: Date.now() - 60 * 60_000,
  etaAt: Date.now(),
  txHash: HASH,
  sourceUnseenAt: Date.now() - 30 * 60_000,
  actions: []
};

const chain = vi.hoisted(() => ({ mined: false, scope: '' }));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, familyChainId: 1, scope: chain.scope })
}));
vi.mock('./adapterContext', () => ({
  wagmiAdapterContext: () => ({
    getClient: () => ({
      getTransactionReceipt: async () => {
        if (chain.mined) return { status: 'success' };
        throw new TransactionReceiptNotFoundError({ hash: HASH });
      },
      getTransaction: async () => {
        throw new TransactionNotFoundError({ hash: HASH });
      }
    })
  })
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('useDismissedSourceWatch', () => {
  beforeEach(() => {
    localStorage.clear();
    chain.mined = false;
    chain.scope = `scope-${Math.random()}`;
  });

  it('brings back a dismissed card once the chain shows its send', async () => {
    dismissedSourceStore.add(chain.scope, BRIDGE);
    chain.mined = true;
    renderHook(useDismissedSourceWatch, { wrapper });
    await waitFor(() =>
      expect(pendingBridgeStore.getSnapshot(chain.scope).map(bridge => bridge.id)).toEqual([HASH])
    );
    expect(pendingBridgeStore.getSnapshot(chain.scope)[0].sourceUnseenAt).toBeUndefined();
    expect(dismissedSourceStore.getSnapshot(chain.scope)).toEqual([]);
  });

  it('leaves it dismissed while the chain has no record of it', async () => {
    dismissedSourceStore.add(chain.scope, BRIDGE);
    renderHook(useDismissedSourceWatch, { wrapper });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(pendingBridgeStore.getSnapshot(chain.scope)).toEqual([]);
    expect(dismissedSourceStore.getSnapshot(chain.scope)).toHaveLength(1);
  });
});
