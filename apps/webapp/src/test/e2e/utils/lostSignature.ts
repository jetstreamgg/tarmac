import { type Page, type Route } from '@playwright/test';

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const APPROVE = '0x095ea7b3';

export type WalletTx = { to?: string; data?: string };

type RpcCall = { id?: number; method?: string; params?: unknown[] };
type RpcReply = { id?: number; result?: `0x${string}` };

/** The bridge send itself: anything that isn't the USDS approve that goes out before it. */
export const notApprove = (tx: WalletTx) => !tx.data?.startsWith(APPROVE);

/** One JSON-RPC call, or each call in a batch. An unparseable body is no calls. */
function rpcCalls(body: string): { batched: boolean; calls: RpcCall[] } {
  try {
    const parsed = JSON.parse(body) as RpcCall | RpcCall[];
    const batched = Array.isArray(parsed);
    return { batched, calls: batched ? parsed : [parsed] };
  } catch {
    return { batched: false, calls: [] };
  }
}

function asWalletTx(params: unknown[] | undefined): WalletTx | undefined {
  const tx = params?.[0];
  return tx && typeof tx === 'object' ? (tx as WalletTx) : undefined;
}

/**
 * The wallet broadcasts one send the predicate names, but the page never hears its hash: the request
 * stays open until a later navigation drops it. A second such send is rejected, so a retry can't send it twice.
 * The predicate receives the parsed transaction, including one inside a JSON-RPC batch.
 */
export async function hangBridgeSend(page: Page, send: (tx: WalletTx) => boolean) {
  let hash: `0x${string}` | undefined;
  let hung = false;
  const handler = async (route: Route) => {
    const body = route.request().postData();
    if (!body?.includes('"eth_sendTransaction"')) return route.fallback();
    const { batched, calls } = rpcCalls(body);
    const matched = calls.filter(call => {
      const tx = call.method === 'eth_sendTransaction' ? asWalletTx(call.params) : undefined;
      return tx ? send(tx) : false;
    });
    if (matched.length === 0) return route.fallback();
    if (hung) {
      const error = { code: 4001, message: 'dropped' };
      const reject = (id: number | undefined) => ({ jsonrpc: '2.0', id, error });
      return route.fulfill({
        json: batched ? calls.map(call => reject(call.id)) : reject(calls[0]?.id ?? 1)
      });
    }
    hung = true;
    const response = await route.fetch();
    const json = (await response.json()) as RpcReply | RpcReply[];
    const replies = Array.isArray(json) ? json : [json];
    const ids = new Set(matched.map(call => String(call.id)));
    hash =
      replies.find(reply => ids.has(String(reply.id)))?.result ??
      (Array.isArray(json) ? undefined : json.result);
  };
  await page.route(TENDERLY_RPC, handler);
  return {
    hash: () => hash,
    stop: () => page.unroute(TENDERLY_RPC, handler)
  };
}

/**
 * A mock load clears storage, so the signature a real reload would keep is put back. Its time is moved
 * past the first early read (2 minutes), and a full scan is stamped as just finished, so the card can
 * come back only from that read and not from the scan a fresh load would run anyway.
 */
export async function restoreLostSignature(
  page: Page,
  intents: [string, string][],
  kind: 'deposit' | 'withdrawal'
) {
  await page.evaluate(
    ({ entries, kind }) => {
      const askedAt = Date.now() - 3 * 60_000;
      entries.forEach(([key, value]) => {
        const restored = (JSON.parse(value) as { at: number }[]).map((intent, index) => ({
          ...intent,
          at: askedAt + index
        }));
        localStorage.setItem(key, JSON.stringify(restored));
        const scope = key.slice('bridgeSendIntent:v1:'.length);
        localStorage.setItem(`bridgeRecoveryScan:v1:${kind}:${scope}`, String(Date.now()));
      });
    },
    { entries: intents, kind }
  );
}
