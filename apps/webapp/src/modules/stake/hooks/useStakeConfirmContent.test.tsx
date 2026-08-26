import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';

const h = {
  txStatus: 'idle' as string,
  updateModalContent: vi.fn()
};

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ updateModalContent: h.updateModalContent, txStatus: h.txStatus })
}));

import { TxStatus } from '@/widgets';
import { useStakeConfirmContent, type StakeLaunchContentContext } from './useStakeConfirmContent';

const STAKE_MODULE = '0x1111111111111111111111111111111111111111' as const;
const lockCall = (data: `0x${string}`): Call => ({ to: STAKE_MODULE, data });

const LOCK = lockCall('0xaa');
const BORROW = lockCall('0xbb');

function Host({
  calls,
  isBatch = false,
  legCount = 2,
  render: renderBody
}: {
  calls: Call[];
  isBatch?: boolean;
  legCount?: number;
  render: (context: StakeLaunchContentContext) => React.ReactNode;
}) {
  const body = useStakeConfirmContent({
    sessionId: 's1',
    calls,
    isBatch,
    legCount,
    content: renderBody
  });
  return <>{body}</>;
}

/** Counts how often the body is rebuilt, and reports the routing it saw. */
const spyBody = () => {
  const seen: StakeLaunchContentContext[] = [];
  const build = vi.fn((context: StakeLaunchContentContext) => {
    seen.push(context);
    return <span data-testid="body">{context.calls.length}</span>;
  });
  return { build, seen };
};

describe('useStakeConfirmContent', () => {
  beforeEach(() => {
    h.txStatus = TxStatus.IDLE;
    h.updateModalContent.mockClear();
  });

  it('pushes the review body while the transaction is still IDLE', () => {
    const { build } = spyBody();
    render(<Host calls={[LOCK, BORROW]} render={build} />);

    expect(h.updateModalContent).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ transactionContent: expect.anything() })
    );
  });

  it('re-pushes when the engine reshapes its calls — the bundle toggle re-prices', () => {
    // Toggling bundling off collapses the legs into one `multicall`, so the
    // calls the fee is priced from change under the open modal. A frozen body
    // would keep quoting the route the user just switched away from.
    const { build, seen } = spyBody();
    const { rerender } = render(<Host calls={[LOCK, BORROW]} isBatch render={build} />);
    h.updateModalContent.mockClear();

    rerender(<Host calls={[lockCall('0xcc')]} isBatch={false} render={build} />);

    expect(h.updateModalContent).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)).toMatchObject({ isBatch: false });
    expect(seen.at(-1)!.calls).toHaveLength(1);
  });

  it('stops pushing once the transaction leaves IDLE', () => {
    // Past Confirm the modal describes something already signed; a mid-flight
    // refetch must not rewrite its summary.
    const { build } = spyBody();
    const { rerender } = render(<Host calls={[LOCK, BORROW]} render={build} />);
    h.updateModalContent.mockClear();
    h.txStatus = TxStatus.INITIALIZED;

    rerender(<Host calls={[lockCall('0xcc')]} render={build} />);

    expect(h.updateModalContent).not.toHaveBeenCalled();
  });

  it('ignores a re-render that only gives the same calldata a new array', () => {
    // `calls` is rebuilt every render. Keying the routing on identity would
    // push on each one, re-rendering the provider, which re-renders this host —
    // the update loop the modal bodies guard against.
    const { build } = spyBody();
    const { rerender } = render(<Host calls={[LOCK, BORROW]} render={build} />);
    const buildsAfterMount = build.mock.calls.length;
    h.updateModalContent.mockClear();

    rerender(<Host calls={[lockCall('0xaa'), lockCall('0xbb')]} render={build} />);

    expect(build).toHaveBeenCalledTimes(buildsAfterMount);
    expect(h.updateModalContent).not.toHaveBeenCalled();
  });

  it('hands the body the flow leg count, not the current route length', () => {
    // With bundling off the engine returns ONE collapsed call for a 3-leg flow.
    // Inferring bundle-ability from that length hides the fee cell's own
    // bundle toggle from exactly the people who have bundling switched off.
    const { build, seen } = spyBody();
    render(<Host calls={[LOCK]} isBatch={false} legCount={3} render={build} />);

    expect(seen.at(-1)).toMatchObject({ legCount: 3 });
  });
});
