import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';
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
  return <>{useStakeConfirmContent({ calls, isBatch, legCount, content: renderBody })}</>;
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
  it('builds the body from the engine routing', () => {
    const { build } = spyBody();
    render(<Host calls={[LOCK, BORROW]} render={build} />);
    expect(screen.getByTestId('body').textContent).toBe('2');
  });

  it('rebuilds when the engine reshapes its calls — the bundle toggle re-prices', () => {
    // Toggling bundling off collapses the legs into one `multicall`, so the calls
    // the fee is priced from change; the body must quote the route the user is on.
    const { build, seen } = spyBody();
    const { rerender } = render(<Host calls={[LOCK, BORROW]} isBatch render={build} />);

    rerender(<Host calls={[lockCall('0xcc')]} isBatch={false} render={build} />);

    expect(seen.at(-1)).toMatchObject({ isBatch: false });
    expect(seen.at(-1)!.calls).toHaveLength(1);
  });

  it('keeps the body when a re-render only gives the same calldata a new array', () => {
    const { build } = spyBody();
    const { rerender } = render(<Host calls={[LOCK, BORROW]} render={build} />);
    const buildsAfterMount = build.mock.calls.length;

    rerender(<Host calls={[lockCall('0xaa'), lockCall('0xbb')]} render={build} />);

    expect(build).toHaveBeenCalledTimes(buildsAfterMount);
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
