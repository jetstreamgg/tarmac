// Prompts that spend a CCTP swap's USDC (its burn or its convert) not answered yet, per scope and swap across mounts.
const openSpends = new Map<string, number>();
const spendKey = (scope: string, swapTxHash: string) => `${scope}:${swapTxHash.toLowerCase()}`;

/** Counts a prompt spending the swap's USDC as open; the returned release counts it answered, once. */
export function openCctpSpend(scope: string, swapTxHash: string) {
  const key = spendKey(scope, swapTxHash);
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

/** A burn or convert of the swap's USDC may still be signed in the wallet; the chain shows none until it mines. */
export const isCctpSpendOpen = (scope: string, swapTxHash: string) =>
  openSpends.has(spendKey(scope, swapTxHash));
