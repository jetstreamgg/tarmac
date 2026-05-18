import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { TxStatus } from '@/widgets/shared/constants';
import { ConnectedContext } from '@/modules/ui/context/ConnectedContext';
import { ConnectModalContext } from '@/modules/ui/context/ConnectModalContext';
import { PsmConversionWidget } from '.';

i18n.load('en', {});
i18n.activate('en');

const connectedContextValue = {
  isConnectedAndAcceptedTerms: true,
  isAuthorized: true,
  setHasAcceptedTerms: () => {},
  isCheckingTerms: false,
  termsCheckError: false,
  retryTermsCheck: () => {},
  authData: { authIsLoading: false },
  vpnData: { vpnIsLoading: false }
};

const connectModalContextValue = {
  isOpen: false,
  openConnectModal: () => {},
  closeConnectModal: () => {}
};

const renderWithI18n = (ui: React.ReactElement) =>
  render(
    <I18nProvider i18n={i18n}>
      <ConnectedContext.Provider value={connectedContextValue}>
        <ConnectModalContext.Provider value={connectModalContextValue}>{ui}</ConnectModalContext.Provider>
      </ConnectedContext.Provider>
    </I18nProvider>
  );

const mockPsmState = vi.hoisted(() => ({
  execute: vi.fn(),
  reset: vi.fn(),
  mutatePocketBalance: vi.fn(),
  refetchBalance: vi.fn(),
  lastParams: undefined as Record<string, any> | undefined,
  conversion: {
    originToken: { symbol: 'USDC', address: '0xorigin' },
    targetToken: { symbol: 'USDS', address: '0xtarget' },
    targetAmount: 10_000_000n,
    needsAllowance: false,
    shouldUseBatch: false,
    currentCallIndex: 0,
    disabledReason: undefined,
    prepared: true,
    isLoading: false,
    error: null
  }
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();

  return {
    ...actual,
    getTokenDecimals: () => 6,
    useTokenBalance: () => ({
      data: { value: 100_000_000n },
      refetch: mockPsmState.refetchBalance
    }),
    useIsBatchSupported: () => ({ data: false }),
    useIsSafeWallet: () => false
  };
});

vi.mock('@/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils')>();

  return {
    ...actual,
    formatBigInt: (value: bigint) => value.toString(),
    getTransactionLink: (_chainId: number, _address: string | undefined, hash: string) =>
      `https://explorer.test/${hash}`
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();

  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({
      address: '0xabc',
      isConnected: true,
      isConnecting: false
    })
  };
});

vi.mock('@/modules/app/hooks/useNotification', () => ({
  useNotification: () => vi.fn()
}));

vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: () => vi.fn()
}));

vi.mock('motion/react', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const motion: any = new Proxy(
    {},
    {
      get: (_t, prop: string) => (prop === 'create' ? () => passthrough : passthrough)
    }
  );
  return {
    AnimatePresence: passthrough,
    motion,
    cubicBezier: () => () => 0
  };
});

vi.mock('@/widgets/shared/animation/Wrappers', () => ({
  CardAnimationWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('@/widgets/shared/components/ui/widget/WidgetContainer', () => ({
  WidgetContainer: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  )
}));

vi.mock('@/widgets/shared/components/ui/widget/WidgetButtons', async () => {
  const React = await import('react');
  const { WidgetContext } = await import('@/widgets/context/WidgetContext');

  return {
    WidgetButtons: ({
      onClickAction,
      onClickBack,
      showSecondaryButton
    }: {
      onClickAction: () => void;
      onClickBack: () => void;
      showSecondaryButton: boolean;
    }) => {
      const { buttonText, backButtonText } = React.useContext(WidgetContext);

      return (
        <div>
          <button onClick={onClickAction} type="button">
            {buttonText}
          </button>
          {showSecondaryButton && (
            <button onClick={onClickBack} type="button">
              {backButtonText || 'Back'}
            </button>
          )}
        </div>
      );
    }
  };
});

vi.mock('@/widgets/shared/components/ui/Typography', () => ({
  Heading: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/widgets/shared/components/ui/transaction/TransactionOverview', () => ({
  TransactionOverview: () => <div>transaction-overview</div>
}));

vi.mock('@/widgets/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  )
}));

vi.mock('@/widgets/shared/components/ui/layout/HStack', () => ({
  HStack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span>back</span>
}));

vi.mock('./components/PsmConversionInputs', () => ({
  PsmConversionInputs: () => <div>psm-inputs</div>
}));

vi.mock('./components/PsmConversionReview', async () => {
  const React = await import('react');
  const { WidgetContext } = await import('@/widgets/context/WidgetContext');

  return {
    PsmConversionReview: () => {
      const { showStepIndicator } = React.useContext(WidgetContext);

      return <div>{`review-step-indicator:${String(showStepIndicator)}`}</div>;
    }
  };
});

vi.mock('./components/PsmConversionStatus', async () => {
  const React = await import('react');
  const { WidgetContext } = await import('@/widgets/context/WidgetContext');

  return {
    PsmConversionStatus: () => {
      const { showStepIndicator, txStatus } = React.useContext(WidgetContext);

      return <div>{`status-step-indicator:${String(showStepIndicator)} status:${txStatus}`}</div>;
    }
  };
});

vi.mock('./hooks/usePsmConversion', () => ({
  usePsmConversion: (params: Record<string, any>) => {
    mockPsmState.lastParams = params;

    return {
      ...mockPsmState.conversion,
      direction: 'USDC_TO_USDS',
      chainId: 1,
      isL2: false,
      isMainnetWrapper: true,
      originAmount: 10_000_000n,
      feeWad: 0n,
      hasNonZeroFee: false,
      haltedValue: undefined,
      isDirectionHalted: false,
      isLive: true,
      spender: '0xspender',
      allowance: undefined,
      batchSupported: false,
      pocketBalance: 100_000_000n,
      hasSufficientLiquidity: true,
      mutateAllowance: vi.fn(),
      mutatePocketBalance: mockPsmState.mutatePocketBalance,
      execute: mockPsmState.execute,
      reset: mockPsmState.reset,
      execution: {
        l2AmountIn: 10_000_000n,
        l2MinAmountOut: 10_000_000n,
        mainnetGemAmt: 10_000_000n,
        mainnetUsdsAmountInWad: 10_000_000_000_000_000_000n
      }
    };
  }
}));

describe('PsmConversionWidget', () => {
  const widgetProps = {
    externalWidgetState: {
      token: 'USDC',
      amount: '10'
    }
  };

  beforeEach(() => {
    mockPsmState.lastParams = undefined;
    mockPsmState.reset.mockReset();
    mockPsmState.mutatePocketBalance.mockReset();
    mockPsmState.refetchBalance.mockReset();
    mockPsmState.execute.mockReset();
    mockPsmState.execute.mockImplementation(() => {
      mockPsmState.lastParams?.onMutate?.();
      mockPsmState.lastParams?.onStart?.('0x123');
    });
    mockPsmState.conversion = {
      originToken: { symbol: 'USDC', address: '0xorigin' },
      targetToken: { symbol: 'USDS', address: '0xtarget' },
      targetAmount: 10_000_000n,
      needsAllowance: false,
      shouldUseBatch: false,
      currentCallIndex: 0,
      disabledReason: undefined,
      prepared: true,
      isLoading: false,
      error: null
    };
  });

  it('hides the two-step indicator for single-transaction PSM conversions', async () => {
    renderWithI18n(<PsmConversionWidget {...widgetProps} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(await screen.findByText('review-step-indicator:false')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm conversion' }));

    expect(await screen.findByText(`status-step-indicator:false status:${TxStatus.LOADING}`)).toBeTruthy();
  });

  it('forwards transaction starts into the shared transaction callbacks', async () => {
    const onWidgetStateChange = vi.fn();

    renderWithI18n(<PsmConversionWidget {...widgetProps} onWidgetStateChange={onWidgetStateChange} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm conversion' }));

    await waitFor(() => {
      expect(onWidgetStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: '0x123',
          txStatus: TxStatus.LOADING
        })
      );
    });
  });
});
