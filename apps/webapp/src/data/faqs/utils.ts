// Utility function to deduplicate FAQ items by question
export function deduplicateFaqItems<T extends { question: string; index: number }>(items: T[]): T[] {
  // Deduplicate by question (title), keeping the first occurrence
  const seen = new Set<string>();
  const deduplicatedItems = items.filter(item => {
    if (seen.has(item.question)) {
      return false;
    }
    seen.add(item.question);
    return true;
  });

  return deduplicatedItems.sort((a, b) => a.index - b.index);
}
