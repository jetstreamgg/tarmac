import { type Page, type Route } from '@playwright/test';

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';

/**
 * The wallet broadcasts one send the predicate names, but the page never hears its hash: the request
 * stays open until a later navigation drops it. A second such send is rejected, so a retry can't send it twice.
 */
export async function hangBridgeSend(page: Page, send: (body: string) => boolean) {
  let hash: `0x${string}` | undefined;
  let hung = false;
  const handler = async (route: Route) => {
    const body = route.request().postData();
    if (!body?.includes('"eth_sendTransaction"') || !send(body)) return route.fallback();
    if (hung)
      return route.fulfill({ json: { jsonrpc: '2.0', id: 1, error: { code: 4001, message: 'dropped' } } });
    hung = true;
    const response = await route.fetch();
    hash = (await response.json()).result;
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
