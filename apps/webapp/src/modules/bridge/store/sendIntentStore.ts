import type { BridgeNetworkId } from '../model/networks';

const KEY_PREFIX = 'bridgeSendIntent:v1:';

/** How long a bridge signature the page lost is looked for on its source network: past the 30-minute read. */
export const SEND_INTENT_MS = 35 * 60_000;

export type SendIntent = { network: BridgeNetworkId; at: number };

type Stored = Partial<Record<BridgeNetworkId, number>>;

const read = (scope: string): Stored => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${KEY_PREFIX}${scope}`) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Stored) : {};
  } catch {
    return {};
  }
};

const write = (scope: string, stored: Stored) => {
  try {
    if (Object.keys(stored).length === 0) localStorage.removeItem(`${KEY_PREFIX}${scope}`);
    else localStorage.setItem(`${KEY_PREFIX}${scope}`, JSON.stringify(stored));
  } catch {
    // Unstored, a reload mid-signature waits for the next full scan.
  }
};

/** A native bridge's signature was asked for on `network`: kept until the wallet answers this page. */
export function markSendIntent(scope: string, network: BridgeNetworkId, at: number) {
  write(scope, { ...read(scope), [network]: at });
}

/** Clears the signature asked for at `at`: a later Confirm's on the same network stays. */
export function clearSendIntent(scope: string, network: BridgeNetworkId, at: number) {
  const stored = read(scope);
  if (stored[network] !== at) return;
  delete stored[network];
  write(scope, stored);
}

/** The signatures a page lost in the last `SEND_INTENT_MS`, whose bridge may have been sent after it. */
export function recentSendIntents(scope: string, now: number): SendIntent[] {
  return Object.entries(read(scope))
    .filter(([, at]) => typeof at === 'number' && now - at >= 0 && now - at < SEND_INTENT_MS)
    .map(([network, at]) => ({ network: network as BridgeNetworkId, at: at as number }));
}

/** The id its scans are stamped under, per send. */
export const sendIntentScanId = (intent: SendIntent) => `intent:${intent.network}:${intent.at}`;
