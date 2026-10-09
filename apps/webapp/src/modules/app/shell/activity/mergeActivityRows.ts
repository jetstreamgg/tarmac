import type { ReactNode } from 'react';

/** A row from outside the indexed history (e.g. local bridges), placed by its time. */
export type ExtraActivityRow = { key: string; timestamp: number; render: () => ReactNode };

export type ActivityRow<T> =
  { kind: 'history'; item: T; index: number } | { kind: 'extra'; row: ExtraActivityRow };

/**
 * History and extra rows, newest first. While older history is still on the
 * server, extra rows older than the last loaded item wait for it.
 */
export function mergeActivityRows<T extends { blockTimestamp: Date }>(
  data: T[],
  extras: ExtraActivityRow[],
  complete: boolean
): ActivityRow<T>[] {
  const oldestLoaded = data.length > 0 ? data[data.length - 1].blockTimestamp.getTime() : undefined;
  const shown =
    complete || oldestLoaded === undefined ? extras : extras.filter(e => e.timestamp >= oldestLoaded);
  const pending = [...shown].sort((a, b) => b.timestamp - a.timestamp);

  const rows: ActivityRow<T>[] = [];
  let next = 0;
  data.forEach((item, index) => {
    while (next < pending.length && pending[next].timestamp > item.blockTimestamp.getTime()) {
      rows.push({ kind: 'extra', row: pending[next++] });
    }
    rows.push({ kind: 'history', item, index });
  });
  for (; next < pending.length; next++) rows.push({ kind: 'extra', row: pending[next] });
  return rows;
}
