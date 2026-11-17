import type { PendingBridge } from '../model/types';
import { openCctpSpend } from './openCctpSpends';
import { SEND_INTENT_MS } from './sendIntentStore';

const KEY = 'bridgeSaleIntent:v1';

/**
 * A prompt selling a claimed CCTP bridge's USDC on Ethereum (its claim's sale or its convert), by card.
 * `amount`: a convert's USDC units, as a decimal string; only a sale of it is read for.
 */
export type SaleIntent = { scope: string; bridgeId: string; at: number; amount?: string };

const isIntent = (value: unknown): value is SaleIntent =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as SaleIntent).scope === 'string' &&
  typeof (value as SaleIntent).bridgeId === 'string' &&
  typeof (value as SaleIntent).at === 'number';

// A malformed amount is dropped, not the prompt: its sale is then read for by the minted amount.
const withAmount = (intent: SaleIntent): SaleIntent =>
  intent.amount === undefined || /^\d+$/.test(String(intent.amount))
    ? intent
    : { scope: intent.scope, bridgeId: intent.bridgeId, at: intent.at };

const read = (): SaleIntent[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isIntent).map(withAmount) : [];
  } catch {
    return [];
  }
};

const write = (intents: SaleIntent[]) => {
  try {
    if (intents.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(intents));
  } catch {
    // Unstored, a sale a reload lost is offered again, as before.
  }
};

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Kept until the wallet answers this page. */
export function markSaleIntent(scope: string, bridgeId: string, at: number, amount?: bigint) {
  const intent: SaleIntent =
    amount === undefined ? { scope, bridgeId, at } : { scope, bridgeId, at, amount: `${amount}` };
  write([...read().filter(kept => at - kept.at < SEND_INTENT_MS), intent]);
}

/** Clears the prompt opened at `at` only. */
export function clearSaleIntent(bridgeId: string, at: number) {
  const intents = read();
  const kept = intents.filter(intent => !same(intent.bridgeId, bridgeId) || intent.at !== at);
  if (kept.length !== intents.length) write(kept);
}

/** The latest sale prompt of the card no page answered in the last `SEND_INTENT_MS`: it may have been signed. */
export const lostSaleIntent = (bridgeId: string, now: number): SaleIntent | undefined =>
  read()
    .filter(
      intent => same(intent.bridgeId, bridgeId) && now - intent.at >= 0 && now - intent.at < SEND_INTENT_MS
    )
    .at(-1);

/** Opens a sale prompt of the card: counted open in this page, and kept across a reload until answered. */
export function openClaimedSale(scope: string, bridgeId: string, amount?: bigint): () => void {
  const at = Date.now();
  const release = openCctpSpend(scope, bridgeId);
  markSaleIntent(scope, bridgeId, at, amount);
  return () => {
    release();
    clearSaleIntent(bridgeId, at);
  };
}

/** What a read for `lost` matches: its convert's amount, sent since it opened, and the card's own and its scope's other cards' sales. */
export const lostSaleRead = (lost: SaleIntent, bridge: PendingBridge, cards: readonly PendingBridge[]) => ({
  bridge,
  amount: lost.amount === undefined ? undefined : BigInt(lost.amount),
  since: lost.at,
  cards: cards.filter(card => card.id !== bridge.id)
});
