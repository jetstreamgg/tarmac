import type { Page, Route } from '@playwright/test';
import type { Address, Hex } from 'viem';
import type { NetworkName } from './constants';
import { getRpcUrlFromFile } from './getRpcUrlFromFile';
import { aggregate3Answer, rpcAt } from './rpcShim';

/** The answer to one contract call, or undefined to leave it to the fork. */
export type CallAnswer = (target: Address, callData: Hex) => Hex | undefined;

/**
 * Answers this page's `eth_call`s on `network`'s fork that `answerCall` answers,
 * alone or inside a Multicall3 aggregate3, and leaves the rest to the fork: a
 * gate reads closed or short for this page only, without a write other workers
 * would see. Returns the removal.
 */
export async function stubForkCalls(page: Page, network: NetworkName, answerCall: CallAnswer) {
  const url = await getRpcUrlFromFile(network);
  const rpc = rpcAt(url);
  const matches = (target: URL) => target.href === url;
  const handler = async (route: Route) => {
    let request: { id?: unknown; method?: string; params?: unknown[] };
    try {
      request = JSON.parse(route.request().postData() ?? '');
    } catch {
      return route.fallback();
    }
    if (Array.isArray(request) || request.method !== 'eth_call') return route.fallback();
    const [tx, block] = (request.params ?? []) as [
      { to?: Address; data?: Hex; input?: Hex } | undefined,
      unknown
    ];
    const data = tx?.data ?? tx?.input;
    if (!tx?.to || !data) return route.fallback();
    const result =
      answerCall(tx.to, data) ?? (await aggregate3Answer(rpc, { to: tx.to, data, block }, answerCall));
    return result ? route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result } }) : route.fallback();
  };
  await page.route(matches, handler);
  return () => page.unroute(matches, handler);
}
