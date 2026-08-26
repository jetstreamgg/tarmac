import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addTermsAcceptance } from './addTermsAcceptance';

const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';

// Mirrors sanitizeUrl's contract closely enough to matter here: it rejects
// anything that isn't an https URL, which is how a missing endpoint is caught.
vi.mock('@/lib/utils', () => ({
  sanitizeUrl: (url: string) => (url.startsWith('https://') ? url : undefined)
}));

describe('addTermsAcceptance', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TERMS_ENDPOINT', 'https://api.example.com/terms-acceptance');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('posts to /add', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201 });

    await addTermsAcceptance(TEST_ADDRESS);

    expect(fetch).toHaveBeenCalledWith('https://api.example.com/terms-acceptance/add', expect.any(Object));
  });

  // The phases are separate routes precisely so neither has to guess from the
  // payload: a body carrying a signature is a 400 here (APP-498).
  it('sends the address and nothing else', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201 });

    await addTermsAcceptance(TEST_ADDRESS);

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body).toEqual({ address: TEST_ADDRESS });
  });

  it('succeeds on 201', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 201 });

    expect(await addTermsAcceptance(TEST_ADDRESS)).toEqual({ ok: true });
  });

  it('reports the status on a rejected write', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400 });

    const result = await addTermsAcceptance(TEST_ADDRESS);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ status: 400 });
  });

  it('reports a network failure rather than throwing', async () => {
    const networkError = new Error('Network error');
    global.fetch = vi.fn().mockRejectedValueOnce(networkError);

    expect(await addTermsAcceptance(TEST_ADDRESS)).toEqual({ ok: false, lastError: networkError });
  });

  it('fails without calling fetch when the endpoint is unusable', async () => {
    vi.stubEnv('VITE_TERMS_ENDPOINT', '');
    global.fetch = vi.fn();

    const result = await addTermsAcceptance(TEST_ADDRESS);

    expect(result.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
