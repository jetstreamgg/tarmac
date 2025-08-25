import { describe, expect, it } from 'vitest';
import { calculateLiquidityBuffer, calculateCapacityBuffer } from './helpers';

describe('stUSDS Buffer Calculations', () => {
  describe('calculateLiquidityBuffer', () => {
    const BASE_RATE = 10n ** 27n;

    it('should return 0 when debt accrual is less than yield accrual', () => {
      const totalAssets = 1000000n * 10n ** 18n; // 1M USDS
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR
      const stakingEngineDebt = 100000n * 10n ** 18n; // 100k debt
      const stakingDuty = BASE_RATE + 158548959918822932n; // 0.5% APR

      const buffer = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty);

      // Yield accrual on 1M should exceed debt accrual on 100k at these rates
      expect(buffer).toBe(0n);
    });

    it('should return positive buffer when debt accrual exceeds yield accrual', () => {
      const totalAssets = 100000n * 10n ** 18n; // 100k USDS
      const ysr = BASE_RATE + 158548959918822932n; // 0.5% APR
      const stakingEngineDebt = 1000000n * 10n ** 18n; // 1M debt
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty);

      // Debt accrual on 1M should exceed yield accrual on 100k
      expect(buffer).toBeGreaterThan(0n);
    });

    it('should handle zero total assets', () => {
      const totalAssets = 0n;
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR
      const stakingEngineDebt = 1000000n * 10n ** 18n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty);

      // With no assets, only debt accrual matters
      expect(buffer).toBeGreaterThan(0n);
    });

    it('should handle zero debt', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR
      const stakingEngineDebt = 0n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty);

      // With no debt, buffer should be 0 (yield accrual only increases liquidity)
      expect(buffer).toBe(0n);
    });

    it('should handle base rate (no yield or duty)', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const ysr = BASE_RATE; // No yield
      const stakingEngineDebt = 1000000n * 10n ** 18n;
      const stakingDuty = BASE_RATE; // No duty

      const buffer = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty);

      // No accrual on either side
      expect(buffer).toBe(0n);
    });

    it('should scale with buffer time', () => {
      const totalAssets = 100000n * 10n ** 18n;
      const ysr = BASE_RATE + 158548959918822932n; // 0.5% APR
      const stakingEngineDebt = 1000000n * 10n ** 18n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer30 = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty, 30);
      const buffer60 = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty, 60);

      // 60 minute buffer should be ~2x the 30 minute buffer
      expect(buffer60).toBeGreaterThan(buffer30);
      expect(buffer60).toBeLessThan(buffer30 * 3n); // Sanity check
    });

    it('should return 0 for zero or negative buffer time', () => {
      const totalAssets = 100000n * 10n ** 18n;
      const ysr = BASE_RATE + 158548959918822932n; // 0.5% APR
      const stakingEngineDebt = 1000000n * 10n ** 18n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer0 = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty, 0);
      const bufferNeg = calculateLiquidityBuffer(totalAssets, ysr, stakingEngineDebt, stakingDuty, -10);

      expect(buffer0).toBe(0n);
      expect(bufferNeg).toBe(0n);
    });
  });

  describe('calculateCapacityBuffer', () => {
    const BASE_RATE = 10n ** 27n;

    it('should calculate yield accrual for 30 minutes', () => {
      const totalAssets = 1000000n * 10n ** 18n; // 1M USDS
      // 1% APR = 0.01 per year / 31536000 seconds = ~3.17e-10 per second
      // Scaled by 1e27 = ~317097919837645865
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateCapacityBuffer(totalAssets, ysr);

      // Should be positive for positive yield
      expect(buffer).toBeGreaterThan(0n);

      // Rough calculation: 1M * 1% / year * 30 minutes
      // 1M * 0.01 / (365 * 24 * 60) minutes * 30 minutes ~= 0.57 USDS
      const expectedMin = 5n * 10n ** 17n; // 0.5 USDS
      const expectedMax = 6n * 10n ** 17n; // 0.6 USDS
      expect(buffer).toBeGreaterThan(expectedMin);
      expect(buffer).toBeLessThan(expectedMax);
    });

    it('should return 0 for base rate', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const ysr = BASE_RATE; // No yield

      const buffer = calculateCapacityBuffer(totalAssets, ysr);

      expect(buffer).toBe(0n);
    });

    it('should return 0 for zero assets', () => {
      const totalAssets = 0n;
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateCapacityBuffer(totalAssets, ysr);

      expect(buffer).toBe(0n);
    });

    it('should scale linearly with assets', () => {
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer1M = calculateCapacityBuffer(1000000n * 10n ** 18n, ysr);
      const buffer2M = calculateCapacityBuffer(2000000n * 10n ** 18n, ysr);

      // 2x assets should give 2x buffer
      expect(buffer2M).toBe(buffer1M * 2n);
    });

    it('should scale with buffer time', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer30 = calculateCapacityBuffer(totalAssets, ysr, 30);
      const buffer60 = calculateCapacityBuffer(totalAssets, ysr, 60);

      // 60 minute buffer should be exactly 2x the 30 minute buffer
      expect(buffer60).toBe(buffer30 * 2n);
    });

    it('should return 0 for zero or negative buffer time', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const ysr = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer0 = calculateCapacityBuffer(totalAssets, ysr, 0);
      const bufferNeg = calculateCapacityBuffer(totalAssets, ysr, -10);

      expect(buffer0).toBe(0n);
      expect(bufferNeg).toBe(0n);
    });
  });
});
