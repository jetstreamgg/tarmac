import { useTransaction } from '@/modules/ui/context/TransactionContext';

/**
 * Whether a page-hosted form must not be edited: its own session is minimized.
 * The engine's paused run was frozen from the form as it was, and Try again on
 * restore resumes that run — an edit made meanwhile is not what gets signed
 * (APP-448). `restore` brings the modal back.
 */
export function useMinimizedSessionLock(sessionId: string): { locked: boolean; restore: () => void } {
  const { isMinimized, activeSessionId, restore } = useTransaction();
  return { locked: isMinimized && activeSessionId === sessionId, restore };
}
