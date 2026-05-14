import { describe, expect, it } from 'vitest';
import { mainnet } from 'viem/chains';
import type { PendleConvertQuote, PendleMarketConfig, Token } from '@/hooks';
import { pendleAnalyticsData } from './pendleAnalyticsData';

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  // 30 days from now — concrete enough to exercise daysToMaturity rounding.
  expiry: Math.floor(Date.now() / 1000) + 30 * 86_400
};

const MATURED_MARKET: PendleMarketConfig = {
  ...MARKET,
  expiry: 1_700_000_000 // 2023 — already matured
};

const USDG_TOKEN: Token = {
  name: 'USDG',
  symbol: 'USDG',
  decimals: 6,
  color: '#00C2A1',
  address: { [mainnet.id]: MARKET.underlyingToken }
};

const USDS_TOKEN: Token = {
  name: 'USDS',
  symbol: 'USDS',
  decimals: 18,
  color: '#000000',
  address: { [mainnet.id]: '0xdc035d45d973e3ec169d2276ddab16f1e407384f' }
};

const PT_TOKEN: Token = {
  name: 'PT-USDG',
  symbol: 'PT-USDG',
  decimals: 6,
  color: '#1BE3C2',
  address: { [mainnet.id]: MARKET.ptToken }
};

const QUOTE: PendleConvertQuote = {
  method: 'exitPostExpToToken',
  amountOut: 1_500_000n,
  apiMinOut: 1_485_000n,
  effectiveApy: 0.054,
  impliedApy: 0.06,
  priceImpact: -0.0012,
  aggregatorType: 'KYBERSWAP',
  feeUsd: 1.23,
  fetchedAt: Date.now(),
  apiContractParams: [],
  apiContractParamsName: []
};

describe('pendleAnalyticsData', () => {
  describe('REDEEM shape', () => {
    it('emits PT as from-side and selected output as to-side', () => {
      const data = pendleAnalyticsData({
        market: MATURED_MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDS_TOKEN,
        amountFromBigint: 1_500_000n,
        amountToBigint: 1_499_500n * 10n ** 12n, // ~1.4995 in USDS (18 decimals)
        fromDecimals: 6,
        toDecimals: 18,
        slippage: 0.01,
        quote: QUOTE,
        isBatchTx: true
      });

      expect(data.tokenSymbolFrom).toBe('PT-USDG');
      expect(data.tokenAddressFrom).toBe(MATURED_MARKET.ptToken);
      expect(data.amountFrom).toBe(1.5);
      expect(data.tokenSymbolTo).toBe('USDS');
      expect(data.tokenAddressTo).toBe(USDS_TOKEN.address[mainnet.id]);
      expect(data.amountTo).toBeCloseTo(1.4995, 4);
    });

    it('emits the consolidated Vaults-base + Pendle-specific fields', () => {
      const data = pendleAnalyticsData({
        market: MATURED_MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1_500_000n,
        amountToBigint: 1_500_000n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        quote: QUOTE,
        isBatchTx: true
      });

      expect(data.module).toBe('pendle');
      expect(data.product).toBe(MATURED_MARKET.name);
      expect(data.productAddress).toBe(MATURED_MARKET.marketAddress);
      expect(data.assetAddress).toBe(MATURED_MARKET.underlyingToken);
      expect(data.assetSymbol).toBe('USDG');
      expect(data.ptAddress).toBe(MATURED_MARKET.ptToken);
      expect(data.expiry).toBe(MATURED_MARKET.expiry);
      expect(data.slippage).toBe(0.01);
    });
  });

  describe('daysToMaturity', () => {
    it('returns 0 for a market that has already matured', () => {
      const data = pendleAnalyticsData({
        market: MATURED_MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        isBatchTx: true
      });

      expect(data.daysToMaturity).toBe(0);
    });

    it('returns ~30 for a market 30 days out', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        isBatchTx: true
      });

      // Math.ceil((expiry*1000 - now) / 86_400_000) — between 29 and 31 covers
      // wall-clock drift in the test runner.
      expect(data.daysToMaturity).toBeGreaterThanOrEqual(29);
      expect(data.daysToMaturity).toBeLessThanOrEqual(31);
    });
  });

  describe('quote fields', () => {
    it('includes aggregatorType, priceImpact, effectiveApy, feeUsd when quote is present', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        quote: QUOTE,
        isBatchTx: true
      });

      expect(data.aggregatorType).toBe('KYBERSWAP');
      expect(data.priceImpact).toBe(-0.0012);
      expect(data.effectiveApy).toBe(0.054);
      expect(data.feeUsd).toBe(1.23);
    });

    it('omits aggregatorType, priceImpact, effectiveApy, feeUsd when quote is undefined', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        isBatchTx: true
      });

      expect(data).not.toHaveProperty('aggregatorType');
      expect(data).not.toHaveProperty('priceImpact');
      expect(data).not.toHaveProperty('effectiveApy');
      expect(data).not.toHaveProperty('feeUsd');
    });

    it('omits a quote field whose value is undefined while keeping the others', () => {
      const partial: PendleConvertQuote = {
        ...QUOTE,
        aggregatorType: undefined,
        feeUsd: undefined
      };
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        quote: partial,
        isBatchTx: true
      });

      expect(data).not.toHaveProperty('aggregatorType');
      expect(data).not.toHaveProperty('feeUsd');
      expect(data.priceImpact).toBe(-0.0012);
      expect(data.effectiveApy).toBe(0.054);
    });
  });

  describe('decimal conversion', () => {
    it('formats USDC (6 decimals) correctly — 1_000_000n = 1', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1_000_000n,
        amountToBigint: 1_000_000n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        isBatchTx: true
      });

      expect(data.amountFrom).toBe(1);
      expect(data.amountTo).toBe(1);
    });

    it('handles 18-decimal target alongside 6-decimal origin', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDS_TOKEN,
        amountFromBigint: 2_500_000n, // 2.5 PT (6dp)
        amountToBigint: 2_500_000_000_000_000_000n, // 2.5 USDS (18dp)
        fromDecimals: 6,
        toDecimals: 18,
        slippage: 0.01,
        isBatchTx: true
      });

      expect(data.amountFrom).toBe(2.5);
      expect(data.amountTo).toBe(2.5);
    });
  });

  describe('isBatchTx', () => {
    it('round-trips true', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        isBatchTx: true
      });
      expect(data.isBatchTx).toBe(true);
    });

    it('round-trips false', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'redeem',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1n,
        amountToBigint: 1n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.01,
        isBatchTx: false
      });
      expect(data.isBatchTx).toBe(false);
    });
  });

  describe('BUY shape', () => {
    it('emits the supply token as from-side and PT as to-side (USDG underlying, 6dp)', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'buy',
        originToken: USDG_TOKEN,
        targetToken: PT_TOKEN,
        amountFromBigint: 1_000_000n, // 1 USDG (6dp)
        amountToBigint: 1_500_000n, // 1.5 PT-USDG (6dp)
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.002,
        quote: QUOTE,
        isBatchTx: false
      });

      expect(data.tokenSymbolFrom).toBe('USDG');
      expect(data.tokenAddressFrom).toBe(USDG_TOKEN.address[mainnet.id]);
      expect(data.amountFrom).toBe(1);
      expect(data.tokenSymbolTo).toBe('PT-USDG');
      expect(data.tokenAddressTo).toBe(PT_TOKEN.address[mainnet.id]);
      expect(data.amountTo).toBe(1.5);
    });

    it('threads non-underlying supply token decimals correctly (USDS, 18dp)', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'buy',
        originToken: USDS_TOKEN, // 18dp underlying
        targetToken: PT_TOKEN,
        amountFromBigint: 2_500_000_000_000_000_000n, // 2.5 USDS (18dp)
        amountToBigint: 2_500_000n, // 2.5 PT (6dp)
        fromDecimals: 18,
        toDecimals: 6,
        slippage: 0.002,
        quote: QUOTE,
        isBatchTx: false
      });

      expect(data.tokenSymbolFrom).toBe('USDS');
      expect(data.amountFrom).toBe(2.5);
      expect(data.tokenSymbolTo).toBe('PT-USDG');
      expect(data.amountTo).toBe(2.5);
    });
  });

  describe('SELL shape', () => {
    it('emits PT as from-side and the withdraw token as to-side (swap of BUY)', () => {
      const data = pendleAnalyticsData({
        market: MARKET,
        side: 'sell',
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        amountFromBigint: 1_500_000n, // 1.5 PT (6dp)
        amountToBigint: 1_000_000n, // 1 USDG (6dp)
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.002,
        quote: QUOTE,
        isBatchTx: false
      });

      expect(data.tokenSymbolFrom).toBe('PT-USDG');
      expect(data.tokenAddressFrom).toBe(PT_TOKEN.address[mainnet.id]);
      expect(data.amountFrom).toBe(1.5);
      expect(data.tokenSymbolTo).toBe('USDG');
      expect(data.tokenAddressTo).toBe(USDG_TOKEN.address[mainnet.id]);
      expect(data.amountTo).toBe(1);
    });
  });

  describe('BUY batch toggle', () => {
    it('structurally matches non-batch BUY except for isBatchTx', () => {
      const common = {
        market: MARKET,
        side: 'buy' as const,
        originToken: USDG_TOKEN,
        targetToken: PT_TOKEN,
        amountFromBigint: 1_000_000n,
        amountToBigint: 1_500_000n,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.002,
        quote: QUOTE
      };
      const nonBatch = pendleAnalyticsData({ ...common, isBatchTx: false });
      const batch = pendleAnalyticsData({ ...common, isBatchTx: true });

      expect(nonBatch.isBatchTx).toBe(false);
      expect(batch.isBatchTx).toBe(true);
      expect({ ...nonBatch, isBatchTx: undefined }).toEqual({ ...batch, isBatchTx: undefined });
    });
  });
});
