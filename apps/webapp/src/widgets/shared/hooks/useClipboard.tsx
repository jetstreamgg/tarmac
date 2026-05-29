import { useEffect, useState, useCallback } from 'react';
import { copyToClipboard } from '@/utils';

export function useClipboard(text: string) {
  const [hasCopied, setHasCopied] = useState(false);

  const [textState, setTextState] = useState(text);
  useEffect(() => setTextState(text), [text]);

  const timeout = 1500;

  const onCopy = useCallback(() => {
    copyToClipboard(
      textState,
      () => setHasCopied(true),
      () => setHasCopied(false)
    );
  }, [textState]);

  useEffect(() => {
    let timeoutId: number | null = null;

    if (hasCopied) {
      timeoutId = window.setTimeout(() => {
        setHasCopied(false);
      }, timeout);
    }

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeout, hasCopied]);

  return {
    value: textState,
    setValue: setTextState,
    onCopy,
    hasCopied
  };
}
