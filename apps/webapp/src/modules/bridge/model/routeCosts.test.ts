import { describe, expect, it } from 'vitest';
import { cctpWithdrawalRoute, nativeDepositRoute, nativeWithdrawalRoute } from './resolveRoute';
import { destinationGas, ethereumStepGas, ethShortfall, routeApprovals, routeFeeText } from './routeCosts';

describe('destinationGas', () => {
  it('adds a prove and a finalize on Ethereum for an OP Stack withdrawal', () => {
    for (const from of ['base', 'optimism', 'unichain'] as const)
      expect(destinationGas(nativeWithdrawalRoute(from))).toBe(850_000n);
  });

  it("adds one outbox execute for an Arbitrum withdrawal, and CCTP's claim and its conversion to USDS", () => {
    expect(destinationGas(nativeWithdrawalRoute('arbitrum'))).toBe(200_000n);
    expect(destinationGas(cctpWithdrawalRoute('base'))).toBe(210_000n + 260_000n);
  });

  it('adds nothing for a deposit, which the bridge delivers', () => {
    expect(destinationGas(nativeDepositRoute('base'))).toBe(0n);
  });
});

describe('routeFeeText', () => {
  it("adds the route's steps on Ethereum to its source fee, as an estimate", () => {
    // 0.00001 ETH + 470k gas at 1 gwei = 0.00048 ETH at $2,000.
    expect(
      routeFeeText({
        route: cctpWithdrawalRoute('base'),
        sourceFeeWei: 10n ** 13n,
        ethFeePerGas: 10n ** 9n,
        ethPrice: 2000
      })
    ).toBe('~$0.96');
  });

  it('is a dash while the source fee or the fee per gas on Ethereum is unknown', () => {
    const route = nativeWithdrawalRoute('base');
    expect(routeFeeText({ route, sourceFeeWei: undefined, ethFeePerGas: 10n ** 9n, ethPrice: 2000 })).toBe(
      '–'
    );
    expect(routeFeeText({ route, sourceFeeWei: 10n ** 13n, ethFeePerGas: undefined, ethPrice: 2000 })).toBe(
      '–'
    );
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

describe('ethereumStepGas', () => {
  it("is each withdrawal step's estimate on Ethereum", () => {
    expect(ethereumStepGas('prove', 'base')).toBe(500_000n);
    expect(ethereumStepGas('finalize', 'optimism')).toBe(350_000n);
    expect(ethereumStepGas('finalize', 'arbitrum')).toBe(200_000n);
    expect(ethereumStepGas('claim', 'base')).toBe(210_000n);
  });
});

describe('ethShortfall', () => {
  it("is the step's ETH cost when the balance doesn't cover it", () => {
    expect(ethShortfall({ balance: 99n, gas: 10n, feePerGas: 10n })).toBe(100n);
  });

  it('is nothing when the balance covers it, or while either read is missing', () => {
    expect(ethShortfall({ balance: 100n, gas: 10n, feePerGas: 10n })).toBeUndefined();
    expect(ethShortfall({ balance: undefined, gas: 10n, feePerGas: 10n })).toBeUndefined();
    expect(ethShortfall({ balance: 0n, gas: 10n, feePerGas: undefined })).toBeUndefined();
  });
});
