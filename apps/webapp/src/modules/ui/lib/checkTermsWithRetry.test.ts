import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkTermsWithRetry, TermsCheckError } from './checkTermsWithRetry';

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';

// Mock sanitizeUrl to pass through
vi.mock('@/lib/utils', () => ({
  sanitizeUrl: (url: string) => url
}));

describe('checkTermsWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_TERMS_ENDPOINT', 'https://api.example.com/terms');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns termsAccepted on successful response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ termsAccepted: true })
    });

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toEqual({ termsAccepted: true, error: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns termsAccepted: false when user has not accepted', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ termsAccepted: false })
    });

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toEqual({ termsAccepted: false, error: false });
  });

  it('retries on network error and succeeds on second attempt', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAccepted: true })
      });

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    // Advance past the retry delay
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ termsAccepted: true, error: false });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on non-OK response and succeeds on third attempt', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ termsAccepted: true })
      });

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ termsAccepted: true, error: false });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('returns error after all retries exhausted (network errors)', async () => {
    const networkError = new Error('Network error');
    global.fetch = vi.fn().mockRejectedValue(networkError);

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.error).toBe(true);
    expect(result.termsAccepted).toBe(false);
    expect((result as TermsCheckError).lastError).toBe(networkError);
    expect(fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('returns error after all retries exhausted (non-OK responses)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.error).toBe(true);
    expect(result.termsAccepted).toBe(false);
    expect((result as TermsCheckError).lastError).toBeInstanceOf(Error);
    expect(((result as TermsCheckError).lastError as Error).message).toContain('500');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('sends correct request body with address', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ termsAccepted: true })
    });

    await checkTermsWithRetry(TEST_ADDRESS);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: TEST_ADDRESS })
      })
    );
  });

  it('returns accessDenied immediately on 403 without retrying', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toEqual({ termsAccepted: false, error: false, accessDenied: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns error immediately on 400 without retrying', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result.error).toBe(true);
    expect(result.termsAccepted).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles mixed failure types across retries', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockRejectedValueOnce(new Error('Connection refused'));

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.error).toBe(true);
    expect(((result as TermsCheckError).lastError as Error).message).toBe('Connection refused');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
