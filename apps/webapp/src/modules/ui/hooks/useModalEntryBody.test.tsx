import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const h = {
  txStatus: 'idle' as string,
  updateModalContent: vi.fn()
};

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ updateModalContent: h.updateModalContent, txStatus: h.txStatus }),
  useEntrySlot: () => null
}));

import { TxStatus } from '@/widgets';
import { useModalEntryBody } from './useModalEntryBody';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import type { TransactionAnalytics } from '@/modules/ui/context/transactionContract';

function Host({
  steps,
  transactionContent,
  confirmLabel,
  confirmAction,
  errorMessage,
  analytics,
  usdValue
}: {
  steps?: TransactionStep[];
  transactionContent?: ReactNode;
  confirmLabel?: string;
  confirmAction?: () => void;
  errorMessage?: string;
  analytics?: TransactionAnalytics;
  usdValue?: number;
}) {
  const renderInSlot = useModalEntryBody({
    sessionId: 's1',
    execute: () => {},
    confirmDisabled: false,
    confirmLabel,
    confirmAction,
    errorMessage,
    steps,
    transactionContent,
    analytics,
    usdValue
  });
  return <>{renderInSlot(<div data-testid="body" />)}</>;
}

const STEPS: TransactionStep[] = [{ label: 'Approve' }, { label: 'Supply' }];

describe('useModalEntryBody — live-push freeze once the tx leaves IDLE', () => {
  beforeEach(() => {
    h.txStatus = TxStatus.IDLE;
    h.updateModalContent.mockClear();
  });

  it('pushes the live config while the tx is IDLE', () => {
    render(<Host steps={STEPS} transactionContent={<span>review</span>} />);
    expect(h.updateModalContent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ steps: STEPS, confirmDisabled: false })
    );
  });

  it('ignores pushes once the tx leaves IDLE — a mid-flight refetch cannot collapse the executed steps', () => {
    const view = render(<Host steps={STEPS} />);
    h.updateModalContent.mockClear();

    // The engine fires; an allowance refetch then rebuilds the body with a
    // collapsed single-step array. The frozen config must keep the executed pair.
    h.txStatus = TxStatus.LOADING;
    view.rerender(<Host steps={[{ label: 'Supply' }]} />);
    expect(h.updateModalContent).not.toHaveBeenCalled();

    h.txStatus = TxStatus.ERROR;
    view.rerender(<Host steps={[]} transactionContent={<span>blank</span>} />);
    expect(h.updateModalContent).not.toHaveBeenCalled();
  });

  it('resumes pushing when the status resets to IDLE (back from a failure re-enters the editable entry)', () => {
    const view = render(<Host steps={STEPS} />);
    h.txStatus = TxStatus.ERROR;
    view.rerender(<Host steps={STEPS} />);
    h.updateModalContent.mockClear();

    h.txStatus = TxStatus.IDLE;
    view.rerender(<Host steps={[{ label: 'Supply' }]} />);
    expect(h.updateModalContent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ steps: [{ label: 'Supply' }] })
    );
  });
});

describe('useModalEntryBody — entry CTA overrides', () => {
  beforeEach(() => {
    h.txStatus = TxStatus.IDLE;
    h.updateModalContent.mockClear();
  });

  it('omits confirmLabel from the entry patch when not supplied, keeping the launch-time label', () => {
    render(<Host />);
    const entry = h.updateModalContent.mock.calls[0][1].entry;
    expect('confirmLabel' in entry).toBe(false);
  });

  it('pushes confirmLabel and confirmAction into the entry patch when supplied', () => {
    const connect = vi.fn();
    render(<Host confirmLabel="Connect wallet" confirmAction={connect} />);
    expect(h.updateModalContent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        entry: expect.objectContaining({ confirmLabel: 'Connect wallet', confirmAction: connect })
      })
    );
  });

  it('always pushes confirmAction so clearing it restores the normal confirm', () => {
    const connect = vi.fn();
    const view = render(<Host confirmLabel="Connect wallet" confirmAction={connect} />);
    h.updateModalContent.mockClear();

    view.rerender(<Host confirmLabel="Continue" />);
    const entry = h.updateModalContent.mock.calls[0][1].entry;
    expect('confirmAction' in entry).toBe(true);
    expect(entry.confirmAction).toBeUndefined();
    expect(entry.confirmLabel).toBe('Continue');
  });
});

describe('useModalEntryBody — engine error slot', () => {
  beforeEach(() => {
    h.txStatus = TxStatus.IDLE;
    h.updateModalContent.mockClear();
  });

  it('pushes errorMessage into both the entry patch (entry screen) and the top level (review stage)', () => {
    render(<Host errorMessage="Prepare failed" />);
    expect(h.updateModalContent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({
        errorMessage: 'Prepare failed',
        entry: expect.objectContaining({ errorMessage: 'Prepare failed' })
      })
    );
  });

  it('always pushes errorMessage so a recovered engine reliably clears a stale message', () => {
    const view = render(<Host errorMessage="Prepare failed" />);
    h.updateModalContent.mockClear();

    view.rerender(<Host />);
    const patch = h.updateModalContent.mock.calls[0][1];
    expect('errorMessage' in patch).toBe(true);
    expect(patch.errorMessage).toBeUndefined();
    expect('errorMessage' in patch.entry).toBe(true);
    expect(patch.entry.errorMessage).toBeUndefined();
  });
});

describe('useModalEntryBody — analytics live merge', () => {
  beforeEach(() => {
    h.txStatus = TxStatus.IDLE;
    h.updateModalContent.mockClear();
  });

  it('pushes analytics alongside the rest of the live config while IDLE', () => {
    const analytics: TransactionAnalytics = {
      widgetName: 'savings',
      flow: 'supply',
      action: 'supply',
      data: { module: 'savings', amount: 100 }
    };
    render(<Host analytics={analytics} />);
    expect(h.updateModalContent).toHaveBeenCalledWith('s1', expect.objectContaining({ analytics }));
  });

  it('omits the analytics key entirely when not supplied — never clobbers a launch-time blob', () => {
    render(<Host />);
    expect('analytics' in h.updateModalContent.mock.calls[0][1]).toBe(false);
  });
});

describe('useModalEntryBody — usdValue live channel (APP-517)', () => {
  beforeEach(() => {
    h.txStatus = TxStatus.IDLE;
    h.updateModalContent.mockClear();
  });

  it('pushes the live valuation while IDLE', () => {
    render(<Host usdValue={300_000} />);
    expect(h.updateModalContent).toHaveBeenCalledWith('s1', expect.objectContaining({ usdValue: 300_000 }));
  });

  it('always pushes the key — an explicit `undefined` (unknown) reaches the config rather than leaving a stale launch value', () => {
    render(<Host usdValue={undefined} />);
    const partial = h.updateModalContent.mock.calls[0][1];
    expect('usdValue' in partial).toBe(true);
    expect(partial.usdValue).toBeUndefined();
  });
});
