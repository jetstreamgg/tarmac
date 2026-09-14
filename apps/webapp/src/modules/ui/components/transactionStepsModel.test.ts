import { describe, expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { TxStatus } from '@/widgets/shared/constants';
import { assignSequentialWrites, deriveTransactionStepItems } from './transactionStepsModel';

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

describe('deriveTransactionStepItems — rows grouped by write (sequential multicall flows)', () => {
  // The stake engine's sequential shape: approve (write 0), then lock + draw +
  // selectFarm + selectVoteDelegate in ONE multicall (write 1).
  const stakeSteps = assignSequentialWrites(
    [
      { label: 'Approve', tokenSymbol: 'SKY' },
      { label: 'Stake', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been staked." },
      { label: 'Borrow', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been borrowed." },
      { label: 'Select reward', tokenSymbol: 'SPK' },
      'Delegate voting power'
    ],
    1
  );

  it('assignSequentialWrites: leading rows are their own writes, the rest share the next one', () => {
    expect(stakeSteps.map(step => (typeof step === 'string' ? undefined : step.write))).toEqual([
      0, 1, 1, 1, 1
    ]);
    expect(stakeSteps[4]).toEqual({ label: 'Delegate voting power', write: 1 });
  });

  it('after the approval mines, every row of the multicall is active together', () => {
    const items = deriveTransactionStepItems({
      steps: stakeSteps,
      currentStep: 1,
      txStatus: TxStatus.LOADING,
      bundled: false
    });
    expect(items.map(item => item.state)).toEqual(['completed', 'active', 'active', 'active', 'active']);
  });

  it('a reverted multicall fails every row of that write, with one Try again on the last', () => {
    const items = deriveTransactionStepItems({
      steps: stakeSteps,
      currentStep: 1,
      txStatus: TxStatus.ERROR,
      bundled: false
    });
    expect(items[0]).toMatchObject({ label: 'Approve', state: 'completed' });
    expect(items.slice(1).map(item => item.label)).toEqual([
      'Stake failed',
      'Borrow failed',
      'Select reward failed',
      'Delegate voting power failed'
    ]);
    expect(items[1].description).toBe(
      "The network rolled back your transaction. The SKY hasn't been staked."
    );
    expect(items[3].description).toBe('The network rolled back your transaction.');
    expect(items.map(item => item.retry)).toEqual([undefined, undefined, undefined, undefined, 'trailing']);
  });

  it('a rejected multicall declines every row of that write', () => {
    const items = deriveTransactionStepItems({
      steps: stakeSteps,
      currentStep: 1,
      txStatus: TxStatus.ERROR,
      bundled: false,
      userRejected: true
    });
    expect(items.slice(1).every(item => item.label.endsWith(' declined'))).toBe(true);
    expect(items.filter(item => item.retry === 'trailing')).toHaveLength(1);
  });

  it("a gate signature prepended ahead of a grouped list offsets the flow's write numbering", () => {
    const items = deriveTransactionStepItems({
      steps: [{ label: 'Sign the terms', kind: 'signature' }, ...stakeSteps],
      currentStep: 2, // signature (0) and approve (1) done, the multicall (2) in flight
      txStatus: TxStatus.LOADING,
      bundled: false
    });
    expect(items.map(item => item.state)).toEqual([
      'completed',
      'completed',
      'active',
      'active',
      'active',
      'active'
    ]);
  });

  it('rows without a write index keep the one-row-per-transaction model', () => {
    const items = deriveTransactionStepItems({
      steps: supplySteps,
      currentStep: 1,
      txStatus: TxStatus.LOADING,
      bundled: false
    });
    expect(items.map(item => item.state)).toEqual(['completed', 'active']);
  });
});

describe('deriveTransactionStepItems — wallet rejection', () => {
  it('a rejected write reads as declined, with no rollback sentence and no consequence detail', () => {
    const items = deriveTransactionStepItems({
      steps: [{ label: 'Withdraw', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been withdrawn." }],
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: false,
      userRejected: true
    });
    expect(items).toEqual([
      {
        stepNumber: 1,
        label: 'Withdraw declined',
        tokenSymbol: undefined,
        targetTokenSymbol: undefined,
        state: 'failed',
        description: 'You declined the request in your wallet. Nothing was sent.',
        retry: 'trailing'
      }
    ]);
  });

  it('a rejected bundle collapses to a "Request declined" slot with the retry slot', () => {
    const items = deriveTransactionStepItems({
      steps: supplySteps,
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: true,
      userRejected: true
    });
    expect(items[0]).toMatchObject({
      label: 'Request declined',
      state: 'failed',
      description:
        'You declined the bundled transaction in your wallet. Try again and confirm it to continue.'
    });
    expect(items[1]).toMatchObject({ state: 'active', retry: 'slot' });
  });

  it('a declined signature keeps its own sentence regardless of the flag', () => {
    const items = deriveTransactionStepItems({
      steps: [{ label: 'Sign the terms', kind: 'signature' }, 'Supply'],
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: false,
      userRejected: true
    });
    expect(items[0]).toMatchObject({
      label: 'Sign the terms failed',
      description: 'The signature request was declined or could not be completed.'
    });
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

// The off-chain prelude (APP-496): a signature step has no hash and no receipt,
// runs before the wallet ever sees a write, and cannot ride inside an EIP-5792
// bundle — so it tracks currentStep one-by-one in BOTH flow shapes, and a
// bundled flow's on-chain steps stay upcoming until the prelude is done.
const signCopy = 'Please review and accept the Terms of Use and Privacy Policy to proceed.';
const signedSupplySteps = [
  { label: 'Sign Terms of Use & Privacy Policy', kind: 'signature' as const, description: signCopy },
  { label: 'Approve', tokenSymbol: 'USDS' },
  { label: 'Supply', tokenSymbol: 'USDS' }
];

describe('deriveTransactionStepItems — signature step, standard flow', () => {
  it('while signing: the signature step is active with its helper copy, on-chain steps upcoming', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 0,
      txStatus: TxStatus.INITIALIZED,
      bundled: false
    });
    expect(items).toEqual([
      expect.objectContaining({ stepNumber: 1, state: 'active', description: signCopy }),
      expect.objectContaining({ stepNumber: 2, label: 'Approve', state: 'upcoming' }),
      expect.objectContaining({ stepNumber: 3, label: 'Supply', state: 'upcoming' })
    ]);
    // The helper copy belongs to the in-progress row only.
    expect(items[1].description).toBeUndefined();
  });

  it('after the signature: it completes (copy hidden) and the first write becomes active', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 1,
      txStatus: TxStatus.LOADING,
      bundled: false
    });
    expect(items.map(i => i.state)).toEqual(['completed', 'active', 'upcoming']);
    expect(items[0].description).toBeUndefined();
  });

  it('a declined signature fails inline with signature copy (not the rollback sentence) and a trailing retry', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: false
    });
    expect(items[0]).toEqual({
      stepNumber: 1,
      label: 'Sign Terms of Use & Privacy Policy failed',
      tokenSymbol: undefined,
      state: 'failed',
      description: 'The signature request was declined or could not be completed.',
      retry: 'trailing'
    });
    expect(items.slice(1).map(i => i.state)).toEqual(['upcoming', 'upcoming']);
  });

  it('success completes every step, signature included', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 2,
      txStatus: TxStatus.SUCCESS,
      bundled: false
    });
    expect(items.map(i => i.state)).toEqual(['completed', 'completed', 'completed']);
  });
});

describe('deriveTransactionStepItems — signature step, bundled flow', () => {
  it('while signing: the bundle has not started, so on-chain steps are upcoming (not active)', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 0,
      txStatus: TxStatus.INITIALIZED,
      bundled: true
    });
    expect(items.map(i => i.state)).toEqual(['active', 'upcoming', 'upcoming']);
    expect(items[0].description).toBe(signCopy);
  });

  it('after the signature: it stays completed while the whole bundle lights up together', () => {
    const inFlight = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 1,
      txStatus: TxStatus.LOADING,
      bundled: true
    });
    expect(inFlight.map(i => i.state)).toEqual(['completed', 'active', 'active']);

    const done = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 1,
      txStatus: TxStatus.SUCCESS,
      bundled: true
    });
    expect(done.map(i => i.state)).toEqual(['completed', 'completed', 'completed']);
  });

  it('a declined signature fails inline — no bundled collapse, because no bundle ever started', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 0,
      txStatus: TxStatus.ERROR,
      bundled: true
    });
    expect(items[0]).toEqual(
      expect.objectContaining({
        label: 'Sign Terms of Use & Privacy Policy failed',
        state: 'failed',
        description: 'The signature request was declined or could not be completed.',
        retry: 'trailing'
      })
    );
    expect(items.slice(1).map(i => i.state)).toEqual(['upcoming', 'upcoming']);
  });

  it('a bundle failure after the signature keeps the completed signature row above the collapsed pair', () => {
    const items = deriveTransactionStepItems({
      steps: signedSupplySteps,
      currentStep: 1,
      txStatus: TxStatus.ERROR,
      bundled: true
    });
    expect(items).toEqual([
      expect.objectContaining({
        stepNumber: 1,
        label: 'Sign Terms of Use & Privacy Policy',
        state: 'completed'
      }),
      expect.objectContaining({ stepNumber: 2, label: 'Transaction failed', state: 'failed' }),
      expect.objectContaining({ stepNumber: 3, label: '', state: 'active', retry: 'slot' })
    ]);
  });
});
