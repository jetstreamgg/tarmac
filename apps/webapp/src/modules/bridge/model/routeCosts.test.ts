import { describe, expect, it } from 'vitest';
import { cctpWithdrawalRoute, nativeDepositRoute, nativeWithdrawalRoute } from './resolveRoute';
import { destinationGas, routeApprovals } from './routeCosts';

describe('destinationGas', () => {
  it('adds a prove and a finalize on Ethereum for an OP Stack withdrawal', () => {
    for (const from of ['base', 'optimism', 'unichain'] as const)
      expect(destinationGas(nativeWithdrawalRoute(from))).toBe(800_000n);
  });

  it("adds one outbox execute for an Arbitrum withdrawal, and one claim for CCTP's", () => {
    expect(destinationGas(nativeWithdrawalRoute('arbitrum'))).toBe(250_000n);
    expect(destinationGas(cctpWithdrawalRoute('base'))).toBe(180_000n);
  });

  it('adds nothing for a deposit, which the bridge delivers', () => {
    expect(destinationGas(nativeDepositRoute('base'))).toBe(0n);
  });
});

describe('routeApprovals', () => {
  it("counts each source call and each destination step, or one bundle's signature", () => {
    expect(routeApprovals(cctpWithdrawalRoute('base'), { calls: 4, isBatch: false })).toBe(5);
    expect(routeApprovals(cctpWithdrawalRoute('base'), { calls: 4, isBatch: true })).toBe(2);
    expect(routeApprovals(nativeWithdrawalRoute('optimism'), { calls: 2, isBatch: false })).toBe(4);
    expect(routeApprovals(nativeWithdrawalRoute('arbitrum'), { calls: 1, isBatch: false })).toBe(2);
  });

  it('is unknown while the source calls are not built', () => {
    expect(routeApprovals(nativeWithdrawalRoute('base'), { calls: 0, isBatch: false })).toBeUndefined();
  });
});
