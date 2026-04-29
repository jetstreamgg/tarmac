import { render } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { PsmConversionReview } from './PsmConversionReview';

vi.mock('@widgets/shared/components/ui/transaction/TransactionReview', () => ({
  TransactionReview: () => <div data-testid="transaction-review" />
}));

vi.mock('wagmi', () => ({
  useChainId: () => 1
}));

describe('PsmConversionReview', () => {
  const setTxTitle = vi.fn();
  const setTxSubtitle = vi.fn();
  const setStepTwoTitle = vi.fn();
  const setOriginToken = vi.fn();
  const setOriginAmount = vi.fn();
  const setTargetToken = vi.fn();
  const setTargetAmount = vi.fn();
  const setTxDescription = vi.fn();

  const originToken = {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x123',
    decimals: 6
  } as any;
  const targetToken = {
    symbol: 'USDS',
    name: 'USDS',
    address: '0x456',
    decimals: 18
  } as any;

  beforeEach(() => {
    i18n.load('en', {});
    i18n.activate('en');
    setTxTitle.mockClear();
    setTxSubtitle.mockClear();
    setStepTwoTitle.mockClear();
    setOriginToken.mockClear();
    setOriginAmount.mockClear();
    setTargetToken.mockClear();
    setTargetAmount.mockClear();
    setTxDescription.mockClear();
  });

  it('describes the actual two-step flow when batching is enabled but unavailable', () => {
    render(
      <I18nProvider i18n={i18n}>
        <WidgetContext.Provider
          value={
            {
              setTxTitle,
              setTxSubtitle,
              setStepTwoTitle,
              setOriginToken,
              setOriginAmount,
              setTargetToken,
              setTargetAmount,
              setTxDescription
            } as any
          }
        >
          <PsmConversionReview
            batchEnabled
            isBatchTransaction={false}
            originToken={originToken}
            originAmount={1_000_000n}
            targetToken={targetToken}
            targetAmount={1_000_000_000_000_000_000n}
            needsAllowance
          />
        </WidgetContext.Provider>
      </I18nProvider>
    );

    expect(setTxSubtitle).toHaveBeenCalledWith('Approve USDC first, then complete the conversion to USDS.');
  });
});
