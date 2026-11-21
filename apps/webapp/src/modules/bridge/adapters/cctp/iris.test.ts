import { describe, expect, it, vi } from 'vitest';
import { BASE_BURN_ATTESTED, BASE_BURN_IRIS_RESPONSE, BASE_BURN_TX } from './cctp.fixtures';
import { FORK_IRIS_PATH, IRIS_API_URL, forkIrisBaseUrl, irisAttestationReader } from './iris';

const respond = (status: number, body?: unknown) =>
  vi.fn(async (url: string) => {
    void url;
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });

describe('irisAttestationReader', () => {
  it('gives up on a hung request, so the caller keeps waiting', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      void url;
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetch);
    try {
      await irisAttestationReader()(6, BASE_BURN_TX.hash);
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reads a transaction's attested messages from its source domain", async () => {
    const fetcher = respond(200, BASE_BURN_IRIS_RESPONSE);
    await expect(irisAttestationReader(IRIS_API_URL, fetcher)(6, BASE_BURN_TX.hash)).resolves.toEqual([
      { message: BASE_BURN_ATTESTED.message, attestation: BASE_BURN_ATTESTED.attestation }
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      `https://iris-api.circle.com/v2/messages/6?transactionHash=${BASE_BURN_TX.hash}`
    );
  });

  it('reads from a proxy at another origin', async () => {
    const fetcher = respond(200, BASE_BURN_IRIS_RESPONSE);
    await irisAttestationReader('https://proxy.example/iris', fetcher)(6, BASE_BURN_TX.hash);
    expect(fetcher.mock.calls[0][0]).toBe(
      `https://proxy.example/iris/v2/messages/6?transactionHash=${BASE_BURN_TX.hash}`
    );
  });

  it('reads nothing while Circle has not indexed the transaction', async () => {
    await expect(irisAttestationReader(IRIS_API_URL, respond(404))(6, BASE_BURN_TX.hash)).resolves.toEqual(
      []
    );
  });

  it.each([
    ['pending confirmations', { status: 'pending_confirmations', attestation: 'PENDING' }],
    ['a V1 message', { cctpVersion: 1 }],
    ['no message', { message: '0x' }],
    ['a non-hex attestation', { attestation: 'PENDING' }]
  ])('skips a message with %s', async (_, change) => {
    const response = { messages: [{ ...BASE_BURN_IRIS_RESPONSE.messages[0], ...change }] };
    await expect(
      irisAttestationReader(IRIS_API_URL, respond(200, response))(6, BASE_BURN_TX.hash)
    ).resolves.toEqual([]);
  });

  it.each([429, 500, 503])('throws on a %s so the bridge keeps waiting', async status => {
    await expect(
      irisAttestationReader(IRIS_API_URL, respond(status))(6, BASE_BURN_TX.hash)
    ).rejects.toThrow();
  });

  it('reads nothing from a body with no message list', async () => {
    await expect(
      irisAttestationReader(IRIS_API_URL, respond(200, { error: 'x' }))(6, BASE_BURN_TX.hash)
    ).resolves.toEqual([]);
  });
});

describe('forkIrisBaseUrl', () => {
  const STAGING = 'https://staging-api.sky.money/cctp-fork-iris';

  it("reads the fork's stand-in from VITE_CCTP_FORK_IRIS_URL in any build", () => {
    expect(forkIrisBaseUrl({ DEV: false, VITE_CCTP_FORK_IRIS_URL: STAGING })).toBe(STAGING);
    expect(forkIrisBaseUrl({ DEV: true, VITE_CCTP_FORK_IRIS_URL: STAGING })).toBe(STAGING);
  });

  it("falls back to the dev server's stand-in, and to none in a build", () => {
    expect(forkIrisBaseUrl({ DEV: true })).toBe(FORK_IRIS_PATH);
    expect(forkIrisBaseUrl({ DEV: false, VITE_CCTP_FORK_IRIS_URL: '' })).toBeUndefined();
  });
});
