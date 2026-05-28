import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadReferralCode(value: string) {
  vi.resetModules();
  vi.stubEnv('VITE_REFERRAL_CODE', value);
  const mod = await import('./constants');
  return mod.REFERRAL_CODE;
}

describe('REFERRAL_CODE', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('parses a valid numeric env var as a number', async () => {
    const code = await loadReferralCode('12345');
    expect(code).toBe(12345);
    expect(typeof code).toBe('number');
  });

  // Pins the safe-fallback behavior; a future "tighten to throw" change must be intentional.
  it('falls back to 0 when the env var is unset', async () => {
    const code = await loadReferralCode('');
    expect(code).toBe(0);
    expect(typeof code).toBe('number');
  });

  it('falls back to 0 when the env var is not a number (NaN || 0 semantics)', async () => {
    const code = await loadReferralCode('not-a-number');
    expect(code).toBe(0);
    expect(typeof code).toBe('number');
  });

  it('resolves to 0 when the env var is the string "0"', async () => {
    const code = await loadReferralCode('0');
    expect(code).toBe(0);
    expect(typeof code).toBe('number');
  });
});
