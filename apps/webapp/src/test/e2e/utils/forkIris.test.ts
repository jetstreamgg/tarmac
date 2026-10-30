import { describe, expect, it, vi } from 'vitest';
import { TransactionReceiptNotFoundError, size, type PublicClient } from 'viem';
import { BASE_BURN_LOGS, BASE_BURN_TX } from '@/modules/bridge/adapters/cctp/cctp.fixtures';
import { irisAttestationReader } from '@/modules/bridge/adapters/cctp/iris';
import { isAttestedCopy, sentMessages } from '@/modules/bridge/adapters/cctp/message';
import { forkIrisResponse } from './forkIris';

const SOURCE = sentMessages(BASE_BURN_LOGS)[0].message;

const fork = ({ enabled = true, receipt = async () => ({ logs: BASE_BURN_LOGS }) } = {}) => {
  const l1 = {
    readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === 'signatureThreshold' ? 2n : enabled
    )
  };
  const l2 = { getTransactionReceipt: vi.fn(receipt) };
  const l2For = vi.fn(() => l2 as unknown as PublicClient);
  return { l1, l2, l2For, clients: { l1: l1 as unknown as PublicClient, l2For } };
};

describe('forkIrisResponse (Iris for the Tenderly multichain fork)', () => {
  it("signs the burn to Ethereum at the fork's threshold, as Iris serves it", async () => {
    const { clients, l2For } = fork();
    const { status, body } = await forkIrisResponse(clients, 6, BASE_BURN_TX.hash);
    expect(status).toBe(200);
    expect(l2For).toHaveBeenCalledWith('base');
    const [entry] = (body as { messages: { message: `0x${string}`; attestation: `0x${string}` }[] }).messages;
    expect(entry).toMatchObject({ status: 'complete', cctpVersion: 2 });
    expect(isAttestedCopy(entry.message, SOURCE)).toBe(true);
    expect(size(entry.attestation)).toBe(2 * 65);
  });

  it("is read by the app's Iris client as the burn's attested message", async () => {
    const { clients } = fork();
    const { status, body } = await forkIrisResponse(clients, 6, BASE_BURN_TX.hash);
    const read = irisAttestationReader('', async () => new Response(JSON.stringify(body), { status }));
    const [attested] = await read(6, BASE_BURN_TX.hash);
    expect(isAttestedCopy(attested.message, SOURCE)).toBe(true);
  });

  it('serves the same copy on every poll', async () => {
    const { clients } = fork();
    const first = await forkIrisResponse(clients, 6, BASE_BURN_TX.hash);
    await expect(forkIrisResponse(clients, 6, BASE_BURN_TX.hash)).resolves.toEqual(first);
  });

  it('serves none, with the fix, until the test attesters are enabled on the Ethereum fork', async () => {
    const { clients } = fork({ enabled: false });
    const response = await forkIrisResponse(clients, 6, BASE_BURN_TX.hash);
    expect(response.status).toBe(404);
    expect(response.warning).toMatch(/enableForkCctpAttesters/);
  });

  it('serves none for a burn the fork has not mined', async () => {
    const { clients } = fork({
      receipt: async () => {
        throw new TransactionReceiptNotFoundError({ hash: BASE_BURN_TX.hash });
      }
    });
    await expect(forkIrisResponse(clients, 6, BASE_BURN_TX.hash)).resolves.toMatchObject({ status: 404 });
  });

  it('serves none for a source that is not a CCTP L2, without reading any chain', async () => {
    const { clients, l2For } = fork();
    await expect(forkIrisResponse(clients, 0, BASE_BURN_TX.hash)).resolves.toMatchObject({ status: 404 });
    await expect(forkIrisResponse(clients, 6, 'not a hash')).resolves.toMatchObject({ status: 404 });
    expect(l2For).not.toHaveBeenCalled();
  });

  it('serves none for a burn from another source domain', async () => {
    const { clients } = fork();
    await expect(forkIrisResponse(clients, 3, BASE_BURN_TX.hash)).resolves.toMatchObject({ status: 404 });
  });

  it('fails on a failed read, so the app keeps waiting', async () => {
    const { clients } = fork({
      receipt: async () => {
        throw new Error('rpc down');
      }
    });
    await expect(forkIrisResponse(clients, 6, BASE_BURN_TX.hash)).rejects.toThrow('rpc down');
  });
});
