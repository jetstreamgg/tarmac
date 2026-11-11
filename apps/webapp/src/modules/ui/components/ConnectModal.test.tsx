import { i18n } from '@lingui/core';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRejectedRequestError } from 'viem';
import { reloadIfChunkError } from '@/lib/staleChunkReload';
import { ConnectModal } from './ConnectModal';

type ConnectOptions = { mutation: { onError: (error: Error, variables: { connector: unknown }) => void } };

const captured = vi.hoisted(() => ({ connect: undefined as ConnectOptions | undefined }));

vi.mock('@/lib/staleChunkReload', () => ({ reloadIfChunkError: vi.fn() }));
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({ trackWalletConnectAttempted: vi.fn(), trackWalletConnectRejected: vi.fn() })
}));
vi.mock('@/hooks', () => ({ useIsSafeApp: () => false }));
vi.mock('wagmi', () => ({
  useConnect: (options: ConnectOptions) => {
    captured.connect = options;
    return { connect: vi.fn(), error: null };
  },
  useConnectors: () => [],
  useConnection: () => ({ connector: undefined }),
  useConnections: () => [],
  useSwitchConnection: () => ({ switchConnection: vi.fn(), error: null })
}));

describe('ConnectModal stale tab recovery', () => {
  beforeEach(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
    vi.mocked(reloadIfChunkError).mockClear();
    render(<ConnectModal open={false} onOpenChange={() => {}} />);
  });

  it('passes a failed connection to the chunk recovery', () => {
    const error = new Error('Failed to fetch dynamically imported module');

    captured.connect?.mutation.onError(error, { connector: { name: 'Base' } });

    expect(reloadIfChunkError).toHaveBeenCalledWith(error);
  });

  it('leaves the page alone when the user rejects the connection', () => {
    captured.connect?.mutation.onError(new UserRejectedRequestError(new Error('rejected')), {
      connector: { name: 'Base' }
    });

    expect(reloadIfChunkError).not.toHaveBeenCalled();
  });
});
