import { useEffect, useState, useCallback } from 'react';
import { copyToClipboard } from '@/utils';

const COPIED_FEEDBACK_MS = 1500;

export function useClipboard(text: string) {
  const [hasCopied, setHasCopied] = useState(false);

  const onCopy = useCallback(() => {
    copyToClipboard(
      text,
      () => setHasCopied(true),
      () => setHasCopied(false)
    );
  }, [text]);

  useEffect(() => {
    if (!hasCopied) return;
    const timeoutId = window.setTimeout(() => setHasCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timeoutId);
  }, [hasCopied]);

  return { onCopy, hasCopied };
}
