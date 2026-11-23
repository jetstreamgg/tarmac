import { createPromptRegistry } from './promptRegistry';

// Prompts that spend a CCTP bridge's USDC not answered yet, per scope and spent USDC across mounts: a stopped
// bridge's on its L2 (its burn or its convert) by swap tx hash, a claimed bridge's on Ethereum (its claim's sale or its
// convert) by bridge id.
const openSpends = createPromptRegistry();
const spendKey = (scope: string, spent: string) => `${scope}:${spent.toLowerCase()}`;

/** Counts a prompt spending that USDC as open; the returned release counts it answered, once. */
export const openCctpSpend = (scope: string, spent: string) => openSpends.open(spendKey(scope, spent));

/** A prompt spending that USDC may still be signed in the wallet; the chain shows none until it mines. */
export const isCctpSpendOpen = (scope: string, spent: string) => openSpends.isOpen(spendKey(scope, spent));
