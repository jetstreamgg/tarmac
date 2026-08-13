import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkTermsWithRetry } from './checkTermsWithRetry';

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';

/** A full, current-contract `/check` body (APP-498 + APP-508). */
const checkBody = (overrides: Record<string, unknown> = {}) => ({
  accepted: true,
  signedForCurrentVersion: false,
  latestVersion: '2026-01-15',
  messageToSign: 'By signing this message, you acknowledge...',
  ...overrides
});

const okResponse = (body: Record<string, unknown> = checkBody()) => ({
  ok: true,
  json: () => Promise.resolve(body)
});

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

  it('returns all four facts on a successful response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse());

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toEqual({
      status: 'ok',
      accepted: true,
      signedForCurrentVersion: false,
      latestVersion: '2026-01-15',
      messageToSign: 'By signing this message, you acknowledge...'
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // The two booleans are uncorrelated: a version bump between the phases leaves
  // a signature for a version that was never accepted, so all four combinations
  // are reachable and none may be inferred from the other.
  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false]
  ])('reports accepted=%s and signedForCurrentVersion=%s independently', async (accepted, signed) => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse(checkBody({ accepted, signedForCurrentVersion: signed })));

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toMatchObject({ status: 'ok', accepted, signedForCurrentVersion: signed });
  });

  it('treats a missing messageToSign as absent rather than failing — only C6 needs it', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse(checkBody({ messageToSign: undefined })));

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toMatchObject({ status: 'ok', accepted: true, messageToSign: undefined });
  });

  // Without a version there is no key for the localStorage flag, so the AND
  // gate could never be satisfied — an explicit error beats a modal that
  // reopens forever.
  it('errors when the response carries no latestVersion', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse(checkBody({ latestVersion: undefined })));

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result.status).toBe('error');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('errors when latestVersion is an empty string', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse(checkBody({ latestVersion: '' })));

    expect((await checkTermsWithRetry(TEST_ADDRESS)).status).toBe('error');
  });

  it('retries on network error and succeeds on second attempt', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(okResponse());

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    // Advance past the retry delay
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toMatchObject({ status: 'ok', accepted: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on non-OK response and succeeds on third attempt', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce(okResponse());

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toMatchObject({ status: 'ok', accepted: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('returns error after all retries exhausted (network errors)', async () => {
    const networkError = new Error('Network error');
    global.fetch = vi.fn().mockRejectedValue(networkError);

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toEqual({ status: 'error', lastError: networkError });
    expect(fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('returns error after all retries exhausted (non-OK responses)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const promise = checkTermsWithRetry(TEST_ADDRESS);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.status).toBe('error');
    expect(result.status === 'error' && (result.lastError as Error).message).toContain('500');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('sends only the address in the request body', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okResponse());

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

  it('returns access-denied immediately on 403 without retrying', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result).toEqual({ status: 'access-denied' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns error immediately on 400 without retrying', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await checkTermsWithRetry(TEST_ADDRESS);

    expect(result.status).toBe('error');
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

    expect(result.status).toBe('error');
    expect(result.status === 'error' && (result.lastError as Error).message).toBe('Connection refused');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
