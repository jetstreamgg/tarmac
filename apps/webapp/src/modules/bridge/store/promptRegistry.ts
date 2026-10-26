/** Why a send is refused while a wallet prompt it would race is still open. */
export const PROMPT_OPEN_MESSAGE = 'Approve or reject the request in your wallet before sending again.';

/** Wallet prompts not answered yet, counted per key across mounts. */
export function createPromptRegistry() {
  const prompts = new Map<string, number>();
  return {
    /** Counts a prompt as open under `key`; the returned release counts it answered, once. */
    open(key: string) {
      prompts.set(key, (prompts.get(key) ?? 0) + 1);
      let open = true;
      return () => {
        if (!open) return;
        open = false;
        const left = (prompts.get(key) ?? 1) - 1;
        if (left > 0) prompts.set(key, left);
        else prompts.delete(key);
      };
    },
    isOpen: (key: string) => prompts.has(key)
  };
}
