import { describe, expect, it } from 'vitest';
import { calculateConversion, calculateMKRtoSKYPrice } from './math';
import { parseEther } from 'viem';

describe('MKR/SKY conversion functions', () => {
  const defaultRate = 24000n;
  const customRate = 30000n;
  const oneMKR = parseEther('1');

  describe('calculateConversion', () => {
    it('should convert MKR to SKY with provided rate', () => {
      const result = calculateConversion({ symbol: 'MKR' }, oneMKR, defaultRate);
      expect(result).toBe(oneMKR * defaultRate);
    });

    it('should convert SKY to MKR with provided rate', () => {
      const skyAmount = parseEther('24000');
      const result = calculateConversion({ symbol: 'SKY' }, skyAmount, defaultRate);
      expect(result).toBe(skyAmount / defaultRate);
    });

    it('should return the same amount for DAI regardless of rate', () => {
      const daiAmount = parseEther('100');
      const result = calculateConversion({ symbol: 'DAI' }, daiAmount, customRate);
      expect(result).toBe(daiAmount);
    });

    it('should return the same amount for USDS regardless of rate', () => {
      const usdsAmount = parseEther('100');
      const result = calculateConversion({ symbol: 'USDS' }, usdsAmount, customRate);
      expect(result).toBe(usdsAmount);
    });

    it('should handle fractional amounts correctly', () => {
      const fractionalMKR = parseEther('0.001');
      const result = calculateConversion({ symbol: 'MKR' }, fractionalMKR, defaultRate);
      expect(result).toBe(fractionalMKR * defaultRate);
    });

    it('should handle zero amount for MKR', () => {
      const result = calculateConversion({ symbol: 'MKR' }, 0n, defaultRate);
      expect(result).toBe(0n);
    });

    it('should handle zero amount for SKY', () => {
      const result = calculateConversion({ symbol: 'SKY' }, 0n, defaultRate);
      expect(result).toBe(0n);
    });

    it('should handle large amounts correctly', () => {
      const largeMKR = parseEther('1000000'); // 1 million MKR
      const result = calculateConversion({ symbol: 'MKR' }, largeMKR, defaultRate);
      expect(result).toBe(largeMKR * defaultRate);
    });

    it('should handle different custom rates', () => {
      const result1 = calculateConversion({ symbol: 'MKR' }, oneMKR, 20000n);
      const result2 = calculateConversion({ symbol: 'MKR' }, oneMKR, 30000n);
      expect(result1).toBe(oneMKR * 20000n);
      expect(result2).toBe(oneMKR * 30000n);
    });
  });

  describe('calculateMKRtoSKYPrice', () => {
    const mkrPrice = parseEther('2400');

    it('should calculate SKY price from MKR price', () => {
      const result = calculateMKRtoSKYPrice(mkrPrice, defaultRate);
      expect(result).toBe(mkrPrice / defaultRate);
    });

    it('should handle different rates correctly', () => {
      const result = calculateMKRtoSKYPrice(mkrPrice, customRate);
      expect(result).toBe(mkrPrice / customRate);
    });

    it('should handle zero MKR price', () => {
      const result = calculateMKRtoSKYPrice(0n, defaultRate);
      expect(result).toBe(0n);
    });

    it('should handle very small MKR prices', () => {
      const smallPrice = 100n; // Very small price
      const result = calculateMKRtoSKYPrice(smallPrice, defaultRate);
      expect(result).toBe(0n); // Should round down to 0
    });

    it('should handle large MKR prices correctly', () => {
      const largePrice = parseEther('1000000'); // $1M per MKR
      const result = calculateMKRtoSKYPrice(largePrice, defaultRate);
      expect(result).toBe(largePrice / defaultRate);
    });
  });

  describe('Edge cases', () => {
    it('should handle unknown token symbols by treating them as SKY', () => {
      const amount = parseEther('100');
      const result = calculateConversion({ symbol: 'UNKNOWN' }, amount, defaultRate);
      expect(result).toBe(amount / defaultRate);
    });

    it('should be case-sensitive for token symbols', () => {
      const amount = parseEther('1');
      const resultLower = calculateConversion({ symbol: 'mkr' }, amount, defaultRate);
      const resultUpper = calculateConversion({ symbol: 'MKR' }, amount, defaultRate);
      // These should be different as the function is case-sensitive
      expect(resultLower).not.toBe(resultUpper);
    });

    it('should maintain precision for large conversions', () => {
      const largeMKR = parseEther('999999.999999999999999999');
      const result = calculateConversion({ symbol: 'MKR' }, largeMKR, defaultRate);
      const expected = largeMKR * defaultRate;
      expect(result).toBe(expected);
    });

    it('should handle very small rates correctly', () => {
      const smallRate = 1n;
      const result = calculateConversion({ symbol: 'MKR' }, oneMKR, smallRate);
      expect(result).toBe(oneMKR * smallRate);
    });

    it('should handle very large rates correctly', () => {
      const largeRate = parseEther('1000000');
      const result = calculateConversion({ symbol: 'MKR' }, oneMKR, largeRate);
      expect(result).toBe(oneMKR * largeRate);
    });
  });
});
