import { unparsedEntries } from './unparsedEntries';

type Listener = () => void;

/**
 * A list per scope in localStorage under `<keyPrefix><scope>`, in sync across
 * tabs. Writes start from storage, so another tab's write is not lost, and
 * carry over the entries this bundle can't parse. A write that fails keeps
 * this session's change on top of what storage holds.
 */
export function createScopedListStore<T>({
  keyPrefix,
  parse,
  toJson,
  idOf,
  retain = () => true,
  order,
  isSame = (a, b) => idOf(a) === idOf(b)
}: {
  keyPrefix: string;
  /** The entry a stored value holds, or null to leave it unparsed. */
  parse: (value: unknown) => T | null;
  toJson: (entry: T) => unknown;
  idOf: (entry: T) => string;
  /** Whether a stored entry is still loaded. */
  retain?: (entry: T) => boolean;
  /** The order every list is kept in; insertion order without it. */
  order?: (a: T, b: T) => number;
  /** Whether a stored entry is the same one as an unsaved one, which hides it. */
  isSame?: (a: T, b: T) => boolean;
}) {
  const listeners = new Set<Listener>();
  const snapshots = new Map<string, T[]>();
  const sorted = (entries: T[]) => (order ? [...entries].sort(order) : entries);

  // Entries whose last change reached only this session's copy (a write failed), by scope.
  const unsaved = new Map<string, Set<string>>();

  /** The stored list; undefined when storage can't be read. */
  const load = (scope: string): T[] | undefined => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(`${keyPrefix}${scope}`);
    } catch {
      return undefined;
    }
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return sorted(
        parsed
          .map(parse)
          .filter((entry): entry is T => entry !== null)
          .filter(retain)
      );
    } catch {
      return [];
    }
  };

  const emit = () => listeners.forEach(listener => listener());

  /** The stored list with this session's unsaved changes on top: added, updated or dropped. */
  const withUnsaved = (scope: string, stored: T[]): T[] => {
    const ids = unsaved.get(scope);
    if (!ids) return stored;
    const own = (snapshots.get(scope) ?? []).filter(entry => ids.has(idOf(entry)));
    return sorted([
      ...own,
      ...stored.filter(entry => !ids.has(idOf(entry)) && !own.some(mine => isSame(mine, entry)))
    ]);
  };

  /** Replaces the scope's list; `changedId` is the entry this write changed. */
  const write = (scope: string, entries: T[], changedId: string) => {
    const next = sorted(entries);
    snapshots.set(scope, next);
    try {
      const key = `${keyPrefix}${scope}`;
      localStorage.setItem(
        key,
        JSON.stringify([...next.map(toJson), ...unparsedEntries(key, entry => parse(entry) !== null)])
      );
      unsaved.delete(scope);
    } catch {
      // ignore storage write failures (private mode, quota); the session copy still updates
      unsaved.set(scope, new Set(unsaved.get(scope)).add(changedId));
    }
    emit();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(keyPrefix)) return;
    snapshots.forEach((_, scope) => {
      if (!unsaved.has(scope)) {
        snapshots.delete(scope);
        return;
      }
      const stored = load(scope);
      if (stored) snapshots.set(scope, withUnsaved(scope, stored));
    });
    emit();
  };

  const getSnapshot = (scope: string): T[] => {
    let snapshot = snapshots.get(scope);
    if (!snapshot) {
      snapshot = load(scope) ?? [];
      snapshots.set(scope, snapshot);
    }
    return snapshot;
  };

  return {
    subscribe(listener: Listener) {
      if (listeners.size === 0) window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot,
    /** The list a write starts from: storage's, with this session's unsaved changes on top. */
    latest(scope: string): T[] {
      const stored = load(scope);
      return stored ? withUnsaved(scope, stored) : getSnapshot(scope);
    },
    write,
    /** Every scope starting with `prefix` with a list, stored or only in this session. */
    scopesStartingWith(prefix: string): string[] {
      const scopes = new Set([...unsaved.keys()].filter(scope => scope.startsWith(prefix)));
      try {
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (!key?.startsWith(`${keyPrefix}${prefix}`) || key.endsWith(':unreadable')) continue;
          scopes.add(key.slice(keyPrefix.length));
        }
      } catch {
        // storage can't be read: only this session's lists
      }
      return [...scopes];
    }
  };
}
