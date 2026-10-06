/**
 * RPC support probe for the batch simulation and the network fee estimate.
 *
 * The bundled pre-send validator (`simulateBatch`) and the bundled fee estimate both rest
 * on behaviour that no spec guarantees an RPC provides. A chain added later without
 * these checks would fail the simulation "structurally" on every flow — which the
 * router degrades to the sequential path, so bundling would silently disappear for
 * that chain. This probe makes that a CI failure instead. Per configured chain:
 *
 * 1. `eth_call` honours a `code` state override at a codeless address.
 * 2. `eth_call` accepts a sender that HAS code — the override puts code at the user's
 *    own address, which only works because these backends skip EIP-3607 in `eth_call`.
 * 3. The stand-in executor (Multicall3, read from whichever configured chain deploys it —
 *    it need not be this one) runs when overridden in at a sender.
 * 4. `eth_simulateV1` runs with validation off (the fee estimator's primitive).
 *
 * Runs against the Tenderly vnets by default. Set `PROBE_RPC_URLS` to a comma-separated
 * list to probe other endpoints (e.g. the production proxy per chain) — note the proxy's
 * WAF rejects non-browser user agents, so the requests carry a browser UA.
 */
import { describe, expect, it } from 'vitest';
import { createPublicClient, decodeFunctionResult, encodeFunctionData, http, type Hex } from 'viem';
import { getTenderlyChains } from '../../../test/hooks/tenderlyChain';
import { TEST_WALLET_ADDRESS } from '../../../test/hooks';
import { multicall3Abi } from './networkFee';
import { getBatchExecutorCode } from './batchExecutorCode';

/** `PUSH1 1; PUSH1 0; MSTORE; PUSH1 32; PUSH1 0; RETURN` — returns the word 1. */
const RETURNS_ONE: Hex = '0x600160005260206000f3';
/** `CALLER; PUSH1 0; MSTORE; PUSH1 32; PUSH1 0; RETURN` — returns msg.sender. */
const RETURNS_CALLER: Hex = '0x3360005260206000f3';
const CODELESS = '0x2222222222222222222222222222222222222222' as const;
const ONE = `0x${'0'.repeat(63)}1` as Hex;

const envUrls =
  process.env.PROBE_RPC_URLS?.split(',')
    .map(url => url.trim())
    .filter(Boolean) ?? [];
const targets: { name: string; url: string }[] = envUrls.length
  ? envUrls.map(url => ({ name: url, url }))
  : getTenderlyChains().map(chain => ({ name: chain.name, url: chain.rpcUrls.default.http[0] }));

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const makeClient = (url: string) =>
  createPublicClient({ transport: http(url, { fetchOptions: { headers: { 'User-Agent': BROWSER_UA } } }) });

describe.each(targets)('batch simulation RPC support — $name', ({ url }) => {
  const client = makeClient(url);
  const fallbackClients = targets.filter(target => target.url !== url).map(target => makeClient(target.url));

  it('honours a code state override on eth_call', async () => {
    const { data } = await client.call({
      to: CODELESS,
      data: '0x',
      stateOverride: [{ address: CODELESS, code: RETURNS_ONE }]
    });
    expect(data).toBe(ONE);
  });

  it('lets a sender with code make an eth_call (EIP-3607 is not enforced there)', async () => {
    // The validator's whole trick: the account itself carries the executor code and
    // calls itself. The inner calls must then see the account as msg.sender.
    const { data } = await client.call({
      account: TEST_WALLET_ADDRESS,
      to: TEST_WALLET_ADDRESS,
      data: '0x',
      stateOverride: [{ address: TEST_WALLET_ADDRESS, code: RETURNS_CALLER }]
    });
    expect(data?.toLowerCase()).toBe(`0x${'0'.repeat(24)}${TEST_WALLET_ADDRESS.slice(2)}`.toLowerCase());
  });

  it('runs the executor code as the overridden account', async () => {
    const code = await getBatchExecutorCode(client, fallbackClients);
    expect(code).toBeDefined();

    // The exact shape the validator issues: aggregate3 on the account itself.
    const { data } = await client.call({
      account: TEST_WALLET_ADDRESS,
      to: TEST_WALLET_ADDRESS,
      data: encodeFunctionData({
        abi: multicall3Abi,
        functionName: 'aggregate3',
        args: [[{ target: CODELESS, allowFailure: true, callData: '0x' }]]
      }),
      stateOverride: [{ address: TEST_WALLET_ADDRESS, code: code! }]
    });
    const results = decodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', data: data! });
    expect(results).toEqual([{ success: true, returnData: '0x' }]);
  });

  it('supports eth_simulateV1 with validation off', async () => {
    const { results } = await client.simulateCalls({
      account: TEST_WALLET_ADDRESS,
      calls: [{ to: CODELESS, data: '0x' }]
    });
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('success');
  });
});
