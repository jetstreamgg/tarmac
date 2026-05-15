/**
 * Copy text to clipboard with callback for success/failure
 * @param text - The text to copy to clipboard
 * @param onSuccess - Callback when copy succeeds
 * @param onError - Callback when copy fails
 */
export function copyToClipboard(
  text: string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      onSuccess?.();
    })
    .catch(err => {
      console.error('Failed to copy text to clipboard', err);
      onError?.(err);
    });
}
