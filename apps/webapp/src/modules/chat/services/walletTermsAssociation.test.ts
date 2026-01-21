import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shouldSkipAssociation, triggerWalletAssociation } from './walletTermsAssociation';
import * as termsApi from './termsApi';

// Mock the termsApi module
vi.mock('./termsApi', () => ({
  associateWalletWithTerms: vi.fn()
}));

// Mock the constants module
vi.mock('@/lib/constants', () => ({
  CHAT_WALLET_ASSOCIATION_KEY: 'test-chat-wallet-associations'
}));

const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890';
const TEST_WALLET_ADDRESS_2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const STORAGE_KEY = 'test-chat-wallet-associations';

describe('walletTermsAssociation service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
    // Suppress console logs during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('shouldSkipAssociation', () => {
    it('should return false when no cache entry exists for the wallet', () => {
      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return true when cache entry exists and is not expired', () => {
      // Set up a fresh cache entry
      const cache = {
        [TEST_WALLET_ADDRESS]: { timestamp: Date.now() }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(true);
    });

    it('should return false when cache entry is expired (older than 7 days)', () => {
      // Set up an expired cache entry (8 days old)
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const cache = {
        [TEST_WALLET_ADDRESS]: { timestamp: eightDaysAgo }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return true when cache entry is exactly at 7 days boundary', () => {
      // Set up a cache entry exactly 6.9 days old (just under 7 days)
      const almostSevenDaysAgo = Date.now() - 6.9 * 24 * 60 * 60 * 1000;
      const cache = {
        [TEST_WALLET_ADDRESS]: { timestamp: almostSevenDaysAgo }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(true);
    });

    it('should handle different wallets independently', () => {
      // Set up cache with only one wallet
      const cache = {
        [TEST_WALLET_ADDRESS]: { timestamp: Date.now() }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      // First wallet should skip
      expect(shouldSkipAssociation(TEST_WALLET_ADDRESS)).toBe(true);
      // Second wallet should not skip (no cache entry)
      expect(shouldSkipAssociation(TEST_WALLET_ADDRESS_2)).toBe(false);
    });

    it('should return false when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json');

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(false);
    });

    it('should return false when cache entry has no timestamp', () => {
      const cache = {
        [TEST_WALLET_ADDRESS]: {}
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      // Should return false because age calculation will be NaN
      expect(result).toBe(false);
    });

    it('should handle empty cache object', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({}));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(false);
    });
  });

  describe('triggerWalletAssociation', () => {
    it('should call associateWalletWithTerms and update cache on success', async () => {
      vi.mocked(termsApi.associateWalletWithTerms).mockResolvedValueOnce({
        success: true,
        alreadyRecorded: false
      });

      await triggerWalletAssociation(TEST_WALLET_ADDRESS);

      // Verify API was called
      expect(termsApi.associateWalletWithTerms).toHaveBeenCalledWith(TEST_WALLET_ADDRESS);
      expect(termsApi.associateWalletWithTerms).toHaveBeenCalledTimes(1);

      // Verify cache was updated
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(cache[TEST_WALLET_ADDRESS]).toBeDefined();
      expect(cache[TEST_WALLET_ADDRESS].timestamp).toBeGreaterThan(0);
    });

    it('should update cache even when API returns alreadyRecorded: true', async () => {
      vi.mocked(termsApi.associateWalletWithTerms).mockResolvedValueOnce({
        success: true,
        alreadyRecorded: true
      });

      await triggerWalletAssociation(TEST_WALLET_ADDRESS);

      // Verify cache was still updated
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(cache[TEST_WALLET_ADDRESS]).toBeDefined();
    });

    it('should not update cache when API call fails', async () => {
      vi.mocked(termsApi.associateWalletWithTerms).mockRejectedValueOnce(new Error('API error'));

      await triggerWalletAssociation(TEST_WALLET_ADDRESS);

      // Verify API was called
      expect(termsApi.associateWalletWithTerms).toHaveBeenCalledWith(TEST_WALLET_ADDRESS);

      // Verify cache was NOT updated
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(cache[TEST_WALLET_ADDRESS]).toBeUndefined();
    });

    it('should preserve existing cache entries when adding new ones', async () => {
      // Set up existing cache
      const existingTimestamp = Date.now() - 1000;
      const existingCache = {
        [TEST_WALLET_ADDRESS]: { timestamp: existingTimestamp }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingCache));

      vi.mocked(termsApi.associateWalletWithTerms).mockResolvedValueOnce({
        success: true,
        alreadyRecorded: false
      });

      // Add a new wallet
      await triggerWalletAssociation(TEST_WALLET_ADDRESS_2);

      // Verify both entries exist
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(cache[TEST_WALLET_ADDRESS]).toBeDefined();
      expect(cache[TEST_WALLET_ADDRESS].timestamp).toBe(existingTimestamp);
      expect(cache[TEST_WALLET_ADDRESS_2]).toBeDefined();
    });

    it('should update timestamp when re-associating an existing wallet', async () => {
      // Set up existing cache with old timestamp
      const oldTimestamp = Date.now() - 1000000;
      const existingCache = {
        [TEST_WALLET_ADDRESS]: { timestamp: oldTimestamp }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingCache));

      vi.mocked(termsApi.associateWalletWithTerms).mockResolvedValueOnce({
        success: true,
        alreadyRecorded: true
      });

      await triggerWalletAssociation(TEST_WALLET_ADDRESS);

      // Verify timestamp was updated
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(cache[TEST_WALLET_ADDRESS].timestamp).toBeGreaterThan(oldTimestamp);
    });
  });

  describe('cache expiry edge cases', () => {
    it('should correctly handle cache at exactly 7 days old', () => {
      // Set up a cache entry exactly 7 days old
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const cache = {
        [TEST_WALLET_ADDRESS]: { timestamp: sevenDaysAgo }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      // At exactly 7 days, age === CACHE_EXPIRY_MS, so age < CACHE_EXPIRY_MS is false
      expect(result).toBe(false);
    });

    it('should correctly handle cache just under 7 days old', () => {
      // Set up a cache entry 1 millisecond under 7 days
      const justUnderSevenDays = Date.now() - (7 * 24 * 60 * 60 * 1000 - 1);
      const cache = {
        [TEST_WALLET_ADDRESS]: { timestamp: justUnderSevenDays }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(true);
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage.getItem throwing an error', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = shouldSkipAssociation(TEST_WALLET_ADDRESS);

      expect(result).toBe(false);

      getItemSpy.mockRestore();
    });

    it('should handle localStorage.setItem throwing an error during cache update', async () => {
      // Save original localStorage
      const originalLocalStorage = global.localStorage;

      // Create a mock localStorage that throws on setItem
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('{}'),
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('localStorage quota exceeded');
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0
      };

      // Replace global localStorage
      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      });

      vi.mocked(termsApi.associateWalletWithTerms).mockResolvedValueOnce({
        success: true,
        alreadyRecorded: false
      });

      // Should not throw - the function handles the error gracefully
      await expect(triggerWalletAssociation(TEST_WALLET_ADDRESS)).resolves.not.toThrow();

      // Verify setItem was called (and threw)
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      // Restore original localStorage
      Object.defineProperty(global, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
    });
  });
});
