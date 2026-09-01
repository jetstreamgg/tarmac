import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signTermsAcceptance } from './signTermsAcceptance';

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';
const SIGNATURE = '0xdeadbeef';

// Mirrors sanitizeUrl's contract closely enough to matter here: it rejects
// anything that isn't an https URL, which is how a missing endpoint is caught.
vi.mock('@/lib/utils', () => ({
  sanitizeUrl: (url: string) => (url.startsWith('https://') ? url : undefined)
}));

describe('signTermsAcceptance', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TERMS_ENDPOINT', 'https://api.example.com/terms-acceptance');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('posts to /sign', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201 });

    await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE);

    expect(fetch).toHaveBeenCalledWith('https://api.example.com/terms-acceptance/sign', expect.any(Object));
  });

  // The message is deliberately NOT in the payload: the worker holds the only
  // copy of the text and verifies against it (APP-508) — a `signedMessage`
  // field would be ignored.
  it('sends address, chainId and signature — nothing else', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201 });

    await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body).toEqual({ address: TEST_ADDRESS, chainId: 1, signature: SIGNATURE });
  });

  it('succeeds on 201 (recorded)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201 });

    expect(await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE)).toEqual({ ok: true });
  });

  // 200 means the worker already had a signature for this (address, version):
  // an idempotent no-op, treated as success so the transaction proceeds.
  it('succeeds on 200 (already signed)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 });

    expect(await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE)).toEqual({ ok: true });
  });

  it('reports the status on a rejected submission', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status: 400 });
  });

  it('reports a network failure rather than throwing', async () => {
    const networkError = new Error('Network error');
    global.fetch = vi.fn().mockRejectedValueOnce(networkError);

    expect(await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE)).toEqual({
      ok: false,
      lastError: networkError
    });
  });

  it('fails without calling fetch when the endpoint is unusable', async () => {
    vi.stubEnv('VITE_TERMS_ENDPOINT', '');
    global.fetch = vi.fn();

    const result = await signTermsAcceptance(TEST_ADDRESS, 1, SIGNATURE);

    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
