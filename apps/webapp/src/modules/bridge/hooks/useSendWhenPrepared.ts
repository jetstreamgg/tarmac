import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

/**
 * A Confirm that may run before its legs are prepared: `send` executes them
 * now when ready, or once they are, and reports their error instead if
 * preparing failed. A modal closed before then drops the send, so nothing
 * reaches the wallet behind it. `cancel` drops it too, for a new launch.
 */
export function useSendWhenPrepared({
  ready,
  error,
  isModalOpen,
  execute,
  onError
}: {
  ready: boolean;
  error: Error | null;
  isModalOpen: boolean;
  execute: () => void;
  onError: (error: Error) => void;
}) {
  const pendingRef = useRef(false);
  const sendRef = useRef(() => undefined as void);
  useLayoutEffect(() => {
    sendRef.current = () => {
      if (!pendingRef.current) return;
      if (!isModalOpen) {
        pendingRef.current = false;
        return;
      }
      if (ready) {
        pendingRef.current = false;
        execute();
      } else if (error) {
        pendingRef.current = false;
        onError(error);
      }
    };
  });
  useEffect(() => sendRef.current(), [ready, error, isModalOpen]);

  return useMemo(
    () => ({
      send: () => {
        pendingRef.current = true;
        sendRef.current();
      },
      cancel: () => {
        pendingRef.current = false;
      }
    }),
    []
  );
}
