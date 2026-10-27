/**
 * What a write to a stored list must carry over from storage: entries this
 * bundle can't parse (a newer one may have written them). An unreadable value
 * is copied once to `<key>:unreadable` first; if that copy fails, this throws
 * and nothing is replaced.
 */
export const unparsedEntries = (key: string, parses: (entry: unknown) => boolean): unknown[] => {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (Array.isArray(parsed)) return parsed.filter(entry => !parses(entry));
  if (localStorage.getItem(`${key}:unreadable`) === null) localStorage.setItem(`${key}:unreadable`, raw);
  return [];
};
