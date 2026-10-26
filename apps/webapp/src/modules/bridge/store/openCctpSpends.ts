// Prompts that spend a CCTP bridge's USDC not answered yet, per scope and spent USDC across mounts: a stopped
// bridge's on its L2 (its burn or its convert) by swap tx hash, a claimed bridge's on Ethereum (its claim's sale or its
// convert) by bridge id.
const openSpends = new Map<string, number>();
const spendKey = (scope: string, spent: string) => `${scope}:${spent.toLowerCase()}`;

/** Counts a prompt spending that USDC as open; the returned release counts it answered, once. */
export function openCctpSpend(scope: string, spent: string) {
  const key = spendKey(scope, spent);
  openSpends.set(key, (openSpends.get(key) ?? 0) + 1);
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const left = (openSpends.get(key) ?? 1) - 1;
    if (left > 0) openSpends.set(key, left);
    else openSpends.delete(key);
  };
}

/** A prompt spending that USDC may still be signed in the wallet; the chain shows none until it mines. */
export const isCctpSpendOpen = (scope: string, spent: string) => openSpends.has(spendKey(scope, spent));
