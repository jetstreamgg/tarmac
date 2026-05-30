import { useEffect, useState, useCallback } from 'react';
import { copyToClipboard } from '@/utils';

export function useClipboard(text: string) {
  const [hasCopied, setHasCopied] = useState(false);

  // Re-sync local state when the `text` prop changes, without an effect.
  // Per React docs: "Adjusting state when a prop changes" pattern.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [textState, setTextState] = useState(text);
  const [prevText, setPrevText] = useState(text);
  if (text !== prevText) {
    setPrevText(text);
    setTextState(text);
  }

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
