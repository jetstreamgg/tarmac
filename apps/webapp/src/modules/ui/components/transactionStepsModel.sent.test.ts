// A failed send never tells the user nothing was sent after a write went through,
// and a refusal before the wallet saw it never claims a rollback.
import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { deriveTransactionStepItems, type SendRefusal, type TransactionStep } from './transactionStepsModel';

// The CCTP burn's sequential steps, one write each.
const CCTP_STEPS: TransactionStep[] = [
  { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
  { label: 'Swap to USDC', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been swapped." },
  { label: 'Approve', tokenSymbol: 'USDC', failureDetail: "The USDC hasn't been approved." },
  { label: 'Bridge', tokenSymbol: 'USDC', failureDetail: "The USDC hasn't been bridged." }
];

const declinedAt = (currentStep: number) =>
  deriveTransactionStepItems({
    steps: CCTP_STEPS,
    currentStep,
    txStatus: TxStatus.ERROR,
    bundled: false,
    userRejected: true
  });

const text = (node: unknown) => (typeof node === 'string' ? node : '');

describe('B-4: a wallet Reject after earlier steps mined', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  it('does not tell the user nothing was sent once approve, swap and approve mined', () => {
    const items = declinedAt(3);
    // The earlier writes are shown as done.
    expect(items.slice(0, 3).map(item => item.state)).toEqual(['completed', 'completed', 'completed']);
    const failed = items[3];
    expect(failed.state).toBe('failed');
    // The USDS was swapped to USDC on-chain: "Nothing was sent" is false.
    expect(text(failed.description)).not.toMatch(/nothing was sent/i);
  });

  it('does not tell the user nothing was sent after a single mined step', () => {
    expect(text(declinedAt(1)[1].description)).not.toMatch(/nothing was sent/i);
  });

  // Control: a Reject on the first step really sent nothing.
  it('still says nothing was sent when the first step is declined', () => {
    expect(text(declinedAt(0)[0].description)).toMatch(/nothing was sent/i);
  });

  // Control: a signed terms prelude is off-chain, so the first write's Reject still sent nothing.
  it('still says nothing was sent when only the terms signature came before', () => {
    const items = deriveTransactionStepItems({
      steps: [{ label: 'Sign the terms', kind: 'signature' }, ...CCTP_STEPS],
      currentStep: 1,
      txStatus: TxStatus.ERROR,
      bundled: false,
      userRejected: true
    });
    expect(items[0].state).toBe('completed');
    expect(text(items[1].description)).toMatch(/nothing was sent/i);
  });
});

const refusedAt = (currentStep: number, refusal: SendRefusal, bundled = false) =>
  deriveTransactionStepItems({
    steps: CCTP_STEPS,
    currentStep,
    txStatus: TxStatus.ERROR,
    bundled,
    userRejected: false,
    refusal
  });

describe('a send refused before the wallet saw it', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  it.each([false, true])('gives its reason and says nothing was sent (bundled: %s)', bundled => {
    const items = refusedAt(0, { reason: 'CCTP is paused.', final: false }, bundled);
    const failed = items.find(item => item.state === 'failed')!;
    expect(text(failed.description)).toBe('CCTP is paused. Nothing was sent.');
    expect(items.some(item => /rolled back|hasn't been/i.test(text(item.description)))).toBe(false);
    expect(items.some(item => item.retry)).toBe(true);
  });

  it('says so without a reason when the refusal has none', () => {
    expect(text(refusedAt(0, { final: false })[0].description)).toBe(
      'The transaction could not be sent. Nothing was sent.'
    );
  });

  it.each([false, true])('offers no retry when sending again cannot succeed (bundled: %s)', bundled => {
    const items = refusedAt(0, { reason: 'This bridge was already sent.', final: true }, bundled);
    expect(items.some(item => item.retry)).toBe(false);
  });

  it('keeps the reason but not "nothing was sent" after earlier writes mined', () => {
    const items = refusedAt(2, { reason: 'CCTP is paused.', final: false });
    expect(items.slice(0, 2).map(item => item.state)).toEqual(['completed', 'completed']);
    expect(text(items[2].description)).toBe('CCTP is paused.');
  });
});
