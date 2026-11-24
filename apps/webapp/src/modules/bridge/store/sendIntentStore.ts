import type { BridgeNetworkId } from '../model/networks';

const KEY_PREFIX = 'bridgeSendIntent:v1:';

/** How long a bridge signature the page lost is looked for on its source network: past the 30-minute read. */
export const SEND_INTENT_MS = 35 * 60_000;

/** `burnAmount`: a CCTP burn's USDC units, as a decimal string; only a burn of it is read for. */
export type SendIntent = { network: BridgeNetworkId; at: number; burnAmount?: string };

const isIntent = (value: unknown): value is SendIntent =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as SendIntent).network === 'string' &&
  typeof (value as SendIntent).at === 'number' &&
  ((value as SendIntent).burnAmount === undefined || /^\d+$/.test(String((value as SendIntent).burnAmount)));

const read = (scope: string): SendIntent[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${KEY_PREFIX}${scope}`) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isIntent) : [];
  } catch {
    return [];
  }
};

const write = (scope: string, intents: SendIntent[]) => {
  try {
    if (intents.length === 0) localStorage.removeItem(`${KEY_PREFIX}${scope}`);
    else localStorage.setItem(`${KEY_PREFIX}${scope}`, JSON.stringify(intents));
  } catch {
    // Unstored, a reload mid-signature waits for the next full scan.
  }
};

/** A native bridge's signature was asked for on `network`: kept until the wallet answers this page. */
export function markSendIntent(scope: string, network: BridgeNetworkId, at: number, burnAmount?: bigint) {
  const intent: SendIntent =
    burnAmount === undefined ? { network, at } : { network, at, burnAmount: `${burnAmount}` };
  // Each Confirm keeps its own: one answered doesn't drop a request an earlier page lost.
  write(scope, [...read(scope).filter(kept => at - kept.at < SEND_INTENT_MS), intent]);
}

/** Clears the signature asked for at `at` only. */
export function clearSendIntent(scope: string, network: BridgeNetworkId, at: number) {
  const intents = read(scope);
  const kept = intents.filter(intent => intent.network !== network || intent.at !== at);
  if (kept.length !== intents.length) write(scope, kept);
}

/** The signatures a page lost in the last `SEND_INTENT_MS`, whose bridge may have been sent after it. */
export function recentSendIntents(scope: string, now: number): SendIntent[] {
  return read(scope).filter(intent => now - intent.at >= 0 && now - intent.at < SEND_INTENT_MS);
}

/** The id its scans are stamped under, per send. */
export const sendIntentScanId = (intent: SendIntent) => `intent:${intent.network}:${intent.at}`;
