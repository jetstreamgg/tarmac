// A send whose outcome can't be read may still mine: its row never claims a rollback nor offers Try again.
import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { deriveTransactionStepItems, type TransactionStep } from './transactionStepsModel';

const STEPS: TransactionStep[] = [
  { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
  { label: 'Bridge', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been bridged." }
];
const REASON = 'Follow it on its card.';

const derive = (change: Partial<Parameters<typeof deriveTransactionStepItems>[0]>) =>
  deriveTransactionStepItems({
    steps: STEPS,
    currentStep: 1,
    txStatus: TxStatus.ERROR,
    bundled: false,
    ...change
  });

describe('deriveTransactionStepItems, a send not confirmed', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  it('says the step is not confirmed yet, with its reason and no Try again', () => {
    const items = derive({ unconfirmed: { reason: REASON } });
    expect(items[0].state).toBe('completed');
    expect(items[1]).toMatchObject({
      label: 'Bridge not confirmed yet',
      state: 'failed',
      description: REASON,
      retry: undefined
    });
  });

  it('collapses a bundle to one slot with no retry slot', () => {
    const items = derive({ bundled: true, currentStep: 0, unconfirmed: { reason: REASON } });
    expect(items).toEqual([
      expect.objectContaining({
        label: 'Transaction not confirmed yet',
        state: 'failed',
        description: REASON
      })
    ]);
  });

  it('leaves a failure that is not one as it was', () => {
    const items = derive({ unconfirmed: null });
    expect(items[1]).toMatchObject({
      label: 'Bridge failed',
      description: "The network rolled back your transaction. The USDS hasn't been bridged.",
      retry: 'trailing'
    });
  });
});
