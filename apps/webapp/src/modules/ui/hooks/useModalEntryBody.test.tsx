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

function Host({ steps, transactionContent }: { steps?: TransactionStep[]; transactionContent?: ReactNode }) {
  const renderInSlot = useModalEntryBody({
    sessionId: 's1',
    execute: () => {},
    confirmDisabled: false,
    steps,
    transactionContent
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
