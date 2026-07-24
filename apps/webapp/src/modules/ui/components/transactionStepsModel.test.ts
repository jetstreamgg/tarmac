import { describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { TxStatus } from '@/widgets/shared/constants';
import { deriveTransactionStepItems } from './transactionStepsModel';

i18n.load('en', {});
i18n.activate('en');

const supplySteps = [
  { label: 'Approve', tokenSymbol: 'USDS' },
  { label: 'Supply', tokenSymbol: 'USDS' }
];

describe('deriveTransactionStepItems — standard flow', () => {
  it('marks earlier steps completed, the current one active, later ones upcoming', () => {
    const items = deriveTransactionStepItems({
      steps: supplySteps,
      currentStep: 1,
      txStatus: TxStatus.LOADING,
      bundled: false
    });
    expect(items).toEqual([
      expect.objectContaining({ stepNumber: 1, label: 'Approve', tokenSymbol: 'USDS', state: 'completed' }),
      expect.objectContaining({ stepNumber: 2, label: 'Supply', tokenSymbol: 'USDS', state: 'active' })
    ]);
  });

  it('on error, the failed step retitles with the rollback description and an inline retry; later steps stay upcoming', () => {
    const items = deriveTransactionStepItems({
      steps: supplySteps,
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: false
    });
    expect(items).toEqual([
      {
        stepNumber: 1,
        label: 'Approve failed',
        tokenSymbol: undefined,
        state: 'failed',
        description: 'The network rolled back your transaction.',
        retry: 'trailing'
      },
      expect.objectContaining({ stepNumber: 2, label: 'Supply', tokenSymbol: 'USDS', state: 'upcoming' })
    ]);
  });

  it("appends a step's failureDetail after the rollback sentence", () => {
    const items = deriveTransactionStepItems({
      steps: [
        { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
        { label: 'Supply', tokenSymbol: 'USDS' }
      ],
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: false
    });
    expect(items[0].description).toBe(
      "The network rolled back your transaction. The USDS hasn't been approved."
    );
  });
});

describe('deriveTransactionStepItems — bundled flow', () => {
  it('marks every step active while the bundle is in flight, completed together on success', () => {
    const inFlight = deriveTransactionStepItems({
      steps: supplySteps,
      currentStep: 0,
      txStatus: TxStatus.LOADING,
      bundled: true
    });
    expect(inFlight.map(i => i.state)).toEqual(['active', 'active']);

    const done = deriveTransactionStepItems({
      steps: supplySteps,
      currentStep: 0,
      txStatus: TxStatus.SUCCESS,
      bundled: true
    });
    expect(done.map(i => i.state)).toEqual(['completed', 'completed']);
  });

  it('on error, collapses to a "Transaction failed" slot plus a retry slot, regardless of step count', () => {
    const items = deriveTransactionStepItems({
      steps: [...supplySteps, { label: 'Sign Terms of Service' }],
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: true
    });
    expect(items).toEqual([
      {
        stepNumber: 1,
        label: 'Transaction failed',
        tokenSymbol: undefined,
        state: 'failed',
        description:
          'The network rolled back your transaction. Try again and confirm bundled transaction in your wallet.'
      },
      { stepNumber: 2, label: '', tokenSymbol: undefined, state: 'active', retry: 'slot' }
    ]);
  });
});
