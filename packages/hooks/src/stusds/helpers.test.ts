import { describe, expect, it } from 'vitest';
import { calculateLiquidityBuffer, calculateCapacityBuffer } from './helpers';

describe('stUSDS Buffer Calculations', () => {
  describe('calculateLiquidityBuffer', () => {
    const BASE_RATE = 10n ** 27n;

    it('should return current liquidity when supply rate exceeds debt rate', () => {
      const totalAssets = 1000000n * 10n ** 18n; // 1M USDS
      const str = BASE_RATE + 317097919837645865n; // 1% APR
      const stakingEngineDebt = 100000n * 10n ** 18n; // 100k debt
      const stakingDuty = BASE_RATE + 158548959918822932n; // 0.5% APR

      const bufferedLiquidity = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty);

      // When yield rate > debt rate, future liquidity > current liquidity
      // So buffered liquidity should equal current liquidity
      const currentLiquidity = totalAssets - stakingEngineDebt;
      expect(bufferedLiquidity).toBe(currentLiquidity);
    });

    it('should return future liquidity when debt rate exceeds supply rate', () => {
      const totalAssets = 100000n * 10n ** 18n; // 100k USDS
      const str = BASE_RATE + 158548959918822932n; // 0.5% APR
      const stakingEngineDebt = 90000n * 10n ** 18n; // 90k debt
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const bufferedLiquidity = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty);

      // When debt rate > yield rate, future liquidity < current liquidity
      // So buffered liquidity should be less than current liquidity
      const currentLiquidity = totalAssets - stakingEngineDebt;
      expect(bufferedLiquidity).toBeLessThan(currentLiquidity);
      expect(bufferedLiquidity).toBeGreaterThan(0n);
    });

    it('should return 0 when debt exceeds assets', () => {
      const totalAssets = 100000n * 10n ** 18n;
      const str = BASE_RATE + 317097919837645865n; // 1% APR
      const stakingEngineDebt = 200000n * 10n ** 18n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const bufferedLiquidity = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty);

      // No liquidity available
      expect(bufferedLiquidity).toBe(0n);
    });

    it('should return full assets when there is no debt', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const str = BASE_RATE + 317097919837645865n; // 1% APR
      const stakingEngineDebt = 0n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const bufferedLiquidity = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty);

      // With no debt, full assets are available as liquidity
      expect(bufferedLiquidity).toBe(totalAssets);
    });

    it('should return current liquidity when there is no rate movement', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const str = BASE_RATE; // No yield
      const stakingEngineDebt = 400000n * 10n ** 18n;
      const stakingDuty = BASE_RATE; // No duty

      const bufferedLiquidity = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty);

      // No accrual on either side, so current = future
      const currentLiquidity = totalAssets - stakingEngineDebt;
      expect(bufferedLiquidity).toBe(currentLiquidity);
    });

    it('should have lower buffer with longer time when debt rate exceeds supply rate', () => {
      const totalAssets = 100000n * 10n ** 18n;
      const str = BASE_RATE + 158548959918822932n; // 0.5% APR
      const stakingEngineDebt = 90000n * 10n ** 18n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer30 = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty, 30);
      const buffer60 = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty, 60);

      // Longer time = more debt accrual relative to yield = lower buffered liquidity
      expect(buffer60).toBeLessThan(buffer30);
      expect(buffer60).toBeGreaterThan(0n);
    });

    it('should return current liquidity for zero or negative buffer time', () => {
      const totalAssets = 100000n * 10n ** 18n;
      const str = BASE_RATE + 158548959918822932n; // 0.5% APR
      const stakingEngineDebt = 90000n * 10n ** 18n;
      const stakingDuty = BASE_RATE + 317097919837645865n; // 1% APR

      const currentLiquidity = totalAssets - stakingEngineDebt;
      const buffer0 = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty, 0);
      const bufferNeg = calculateLiquidityBuffer(totalAssets, str, stakingEngineDebt, stakingDuty, -10);

      // No time buffer means no accrual, so current = future
      expect(buffer0).toBe(currentLiquidity);
      expect(bufferNeg).toBe(currentLiquidity);
    });
  });

  describe('calculateCapacityBuffer', () => {
    const BASE_RATE = 10n ** 27n;

    it('should calculate yield accrual for 30 minutes', () => {
      const totalAssets = 1000000n * 10n ** 18n; // 1M USDS
      // 1% APR = 0.01 per year / 31536000 seconds = ~3.17e-10 per second
      // Scaled by 1e27 = ~317097919837645865
      const str = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateCapacityBuffer(totalAssets, str);

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
      const str = BASE_RATE; // No yield

      const buffer = calculateCapacityBuffer(totalAssets, str);

      expect(buffer).toBe(0n);
    });

    it('should return 0 for zero assets', () => {
      const totalAssets = 0n;
      const str = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer = calculateCapacityBuffer(totalAssets, str);

      expect(buffer).toBe(0n);
    });

    it('should scale linearly with assets', () => {
      const str = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer1M = calculateCapacityBuffer(1000000n * 10n ** 18n, str);
      const buffer2M = calculateCapacityBuffer(2000000n * 10n ** 18n, str);

      // 2x assets should give 2x buffer
      expect(buffer2M).toBe(buffer1M * 2n);
    });

    it('should scale with buffer time', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const str = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer30 = calculateCapacityBuffer(totalAssets, str, 30);
      const buffer60 = calculateCapacityBuffer(totalAssets, str, 60);

      // 60 minute buffer should be exactly 2x the 30 minute buffer
      expect(buffer60).toBe(buffer30 * 2n);
    });

    it('should return 0 for zero or negative buffer time', () => {
      const totalAssets = 1000000n * 10n ** 18n;
      const str = BASE_RATE + 317097919837645865n; // 1% APR

      const buffer0 = calculateCapacityBuffer(totalAssets, str, 0);
      const bufferNeg = calculateCapacityBuffer(totalAssets, str, -10);

      expect(buffer0).toBe(0n);
      expect(bufferNeg).toBe(0n);
    });
  });
});
