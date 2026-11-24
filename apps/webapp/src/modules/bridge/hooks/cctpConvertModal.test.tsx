import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cctpConvertModal, convertSteps } from './cctpConvertModal';

vi.mock('../components/CctpConvertReview', () => ({ CctpConvertReview: () => null }));

beforeAll(() => {
  i18n.loadAndActivate({ locale: 'en', messages: {} });
});

describe('cctpConvertModal', () => {
  it('reviews the conversion and toasts the USDC it converts', () => {
    const modal = cctpConvertModal({ amount: 1_234_500_000n, bridged: 1_300_000_000n, chainId: 1 });
    expect(modal.title).toBe('Review conversion');
    expect(modal.transactionTitle).toBe('Review conversion');
    expect(modal.confirmLabel).toBe('Confirm');
    expect(modal.toast).toEqual({
      loading: 'Converting 1,234.50 USDC to USDS',
      success: 'Funds converted successfully!',
      error: 'Conversion failed'
    });
    expect(modal.steps).toMatchObject([{ label: 'Convert', tokenSymbol: 'USDC', targetTokenSymbol: 'USDS' }]);
    // The hero reads the wallet's chain, so its props are checked instead of its render.
    expect(modal.transactionScreenContent.props).toEqual({
      from: { symbol: 'USDC', amount: '1,234.50' },
      to: { symbol: 'USDS', amount: '1,234.50' },
      testId: 'bridge-convert-amount'
    });
  });
});

describe('convertSteps', () => {
  it('one step per call: the approve when short, then the sale', () => {
    expect(convertSteps([{ functionName: 'approve' }, { functionName: 'sellGem' }])).toMatchObject([
      { label: 'Approve' },
      { label: 'Convert' }
    ]);
    expect(convertSteps([{ functionName: 'sellGem' }])).toMatchObject([{ label: 'Convert' }]);
  });
});
