import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { checkTermsWithRetry } from './checkTermsWithRetry';
import { addTermsAcceptance } from './addTermsAcceptance';

/**
 * Drives the real client code against a locally-running api-worker and a local
 * Supabase, which is how api-workers #112 was verified end-to-end. Nothing on
 * staging serves this contract yet, so this is the only way to exercise it.
 *
 * Opt-in — CI has neither dependency, so it is skipped unless asked for:
 *
 *   1. sky-money-supabase (branch feature/app-495-terms-acceptance-events,
 *      i.e. PRs #10 + #13):  supabase start
 *   2. api-workers at PR #113's head, with .dev.vars overriding
 *      ENVIRONMENT="development", SUPABASE_URL/KEY at the local stack:
 *        pnpm exec wrangler dev --port 8787 --local
 *   3. TERMS_INTEGRATION=1 pnpm exec vitest run src/modules/ui/lib/termsAcceptance.integration.test.ts
 */

const ENABLED = process.env.TERMS_INTEGRATION === '1';
const WORKER = 'http://localhost:8787/terms-acceptance';
const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

/**
 * `getClientIp` honours `?ip=` outside production, and the worker refuses a
 * request it cannot geolocate. This is one of the three allow-listed IPs, and
 * the only one that is neither VPN nor a restricted region (AR).
 */
const TEST_IP = '98.97.135.25';

// localhost is neither https nor allow-listed, so the real sanitizeUrl would
// drop it. Appending the IP override here keeps it out of the production code.
vi.mock('@/lib/utils', () => ({
  sanitizeUrl: (url: string) => `${url}?ip=${'98.97.135.25'}`
}));

const sql = (query: string) => execFileSync('psql', [DB, '-tAc', query], { encoding: 'utf8' }).trim();

const eventRows = (address: string) =>
  Number(
    sql(`select count(*) from public.terms_acceptance_events where address = '${address.toLowerCase()}'`)
  );

const signatureRows = (address: string) =>
  Number(sql(`select count(*) from public."terms-acceptance" where address = '${address.toLowerCase()}'`));

const post = (path: string, body: unknown) =>
  fetch(`${WORKER}${path}?ip=${TEST_IP}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

/** A fresh wallet per run, so no test depends on another's rows. */
const newWallet = () => privateKeyToAccount(generatePrivateKey());

describe.runIf(ENABLED)('terms acceptance against a local worker', () => {
  beforeAll(() => {
    vi.stubEnv('VITE_TERMS_ENDPOINT', WORKER);
  });

  it('serves the four-field check response', async () => {
    const { address } = newWallet();

    const result = await checkTermsWithRetry(address);

    expect(result).toMatchObject({
      status: 'ok',
      accepted: false,
      signedForCurrentVersion: false,
      latestVersion: expect.any(String)
    });
    // The message the webapp must never hold a copy of.
    expect(result.status === 'ok' && result.messageToSign).toEqual(expect.stringContaining('By signing'));
  });

  it('records an acceptance and flips accepted on the next check', async () => {
    const { address } = newWallet();
    expect((await checkTermsWithRetry(address)) as object).toMatchObject({ accepted: false });

    expect(await addTermsAcceptance(address)).toEqual({ ok: true });

    expect((await checkTermsWithRetry(address)) as object).toMatchObject({ accepted: true });
    expect(eventRows(address)).toBe(1);
  });

  // The returning-user case the AND gate creates: a second browser re-prompts,
  // and that acceptance must append rather than error or overwrite.
  it('accumulates a separate row per repeat acceptance', async () => {
    const { address } = newWallet();

    expect(await addTermsAcceptance(address)).toEqual({ ok: true });
    expect(await addTermsAcceptance(address)).toEqual({ ok: true });
    expect(await addTermsAcceptance(address)).toEqual({ ok: true });

    expect(eventRows(address)).toBe(3);
  });

  it('answers 201 to an acceptance', async () => {
    const { address } = newWallet();

    expect((await post('/add', { address })).status).toBe(201);
  });

  // B3 split the phases onto separate routes precisely so neither has to guess
  // from the payload. A mis-routed signature must not land as a checkbox
  // acceptance.
  it('refuses a signature posted to /add, and writes nothing', async () => {
    const { address } = newWallet();

    const response = await post('/add', { address, chainId: 1, signature: '0xdeadbeef' });

    expect(response.status).toBe(400);
    expect(eventRows(address)).toBe(0);
  });

  it('ignores a stray chainId on /add', async () => {
    const { address } = newWallet();

    expect((await post('/add', { address, chainId: 1 })).status).toBe(201);
    expect(eventRows(address)).toBe(1);
  });

  describe('phase B', () => {
    it('records a signature over the served message and flips signedForCurrentVersion', async () => {
      const account = newWallet();
      const checked = await checkTermsWithRetry(account.address);
      if (checked.status !== 'ok' || !checked.messageToSign) throw new Error('no message served');

      // Exactly what C6 will do: sign the string the worker gave us, unchanged.
      const signature = await account.signMessage({ message: checked.messageToSign });
      const response = await post('/sign', { address: account.address, chainId: 1, signature });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ signatureAttached: true });
      expect(signatureRows(account.address)).toBe(1);

      const after = await checkTermsWithRetry(account.address);
      expect(after).toMatchObject({ signedForCurrentVersion: true });
      // Phase B records no acceptance event, so browsing stays gated.
      expect(after).toMatchObject({ accepted: false });
      expect(eventRows(account.address)).toBe(0);
    });

    // The replay path B4 exists to close: a signature that recovers correctly
    // to the submitting address but attests to something else entirely.
    it('rejects a valid signature over a different message', async () => {
      const account = newWallet();
      const signature = await account.signMessage({ message: 'gm' });

      const response = await post('/sign', { address: account.address, chainId: 1, signature });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(signatureRows(account.address)).toBe(0);
    });

    it('is an idempotent no-op when the version is already signed', async () => {
      const account = newWallet();
      const checked = await checkTermsWithRetry(account.address);
      if (checked.status !== 'ok' || !checked.messageToSign) throw new Error('no message served');
      const signature = await account.signMessage({ message: checked.messageToSign });

      expect((await post('/sign', { address: account.address, chainId: 1, signature })).status).toBe(201);

      const repeat = await post('/sign', { address: account.address, chainId: 1, signature });
      expect(repeat.status).toBe(200);
      expect(await repeat.json()).toEqual({ signatureAttached: false });
      expect(signatureRows(account.address)).toBe(1);
    });
  });
});
