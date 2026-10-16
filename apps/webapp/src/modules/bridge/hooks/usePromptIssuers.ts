import { useRef } from 'react';
import type { TxMutateVariables } from '@/hooks/hooks';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Remembers the callbacks of the Confirm that opened each wallet prompt, so a
 * prompt signed or rejected after another Confirm reports to its own card,
 * never to the current one. Prompts with no request object go to the current callbacks.
 */
export function usePromptIssuers(getCallbacks: () => TxCallbacks) {
  const issuersRef = useRef(new WeakMap<object, TxCallbacks>());
  return {
    onMutate: (variables?: TxMutateVariables) => {
      if (variables) issuersRef.current.set(variables, getCallbacks());
      getCallbacks().onMutate(variables);
    },
    issuerOf: (variables?: TxMutateVariables) =>
      (variables && issuersRef.current.get(variables)) ?? getCallbacks()
  };
}
