/** Django-REST page envelope every paginated BA Labs list endpoint returns. */
type BaLabsPage<T> = {
  /** Total rows across all pages, not the length of `results`. */
  count?: number;
  /** Absolute URL of the next page, or null on the last one. */
  next?: string | null;
  results?: T[];
};

/**
 * Hard ceiling on pages walked, so a malformed `count` can't spin forever. At
 * the endpoint's 1000-row page size this covers 50k rows — an order of
 * magnitude more than the longest series (daily points back to 2019).
 */
const MAX_PAGES = 50;

/**
 * Fetch every page of a paginated BA Labs list endpoint and return the
 * concatenated `results`.
 *
 * The API silently caps a page at 1000 rows no matter how large a `p_size` we
 * ask for, and only advertises the rest through `count` and `next` — so a single
 * `?p_size=9999` request quietly truncated the longest series to its most recent
 * 1000 days (the `overall/historic/` chart started in Nov 2023 instead of Nov
 * 2019 — APP-456 #5). Its `next` link is unusable directly: the API builds it
 * with an `http://` scheme, which the browser blocks as mixed content on our
 * https origin. So we page by rewriting our own `p` query param on the caller's
 * URL and only consult `next` as the stop signal.
 *
 * The first page is awaited on its own (it carries the row count); the remaining
 * pages go out concurrently. A page that fails or comes back empty ends the walk
 * with whatever resolved — a short series beats no series.
 */
export async function fetchBaLabsPages<T>(url: URL): Promise<T[]> {
  const getPage = async (page: number): Promise<BaLabsPage<T> | undefined> => {
    const pageUrl = new URL(url);
    if (page > 1) pageUrl.searchParams.set('p', String(page));

    const response = await fetch(pageUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
      console.warn('Received non-ok response from BaLabs', {
        url: pageUrl.href,
        status: response.status
      });
      return undefined;
    }
    return (await response.json()) as BaLabsPage<T>;
  };

  const first = await getPage(1);
  const firstResults = first?.results ?? [];
  // No `next` means the caller's p_size already covered the whole series.
  if (!first?.next || firstResults.length === 0) return firstResults;

  // Only chase pages the caller actually asked for. `p_size` is the row budget:
  // a hook that wants the latest single datapoint passes 1 and must not walk
  // 2000 rows behind it, while a full-history chart passes 9999 and gets
  // everything the endpoint holds.
  const requested = Number(url.searchParams.get('p_size'));
  const wanted = Number.isFinite(requested) && requested > 0 ? requested : firstResults.length;
  const target = Math.min(wanted, first.count ?? firstResults.length);
  const pageCount = Math.min(Math.ceil(target / firstResults.length), MAX_PAGES);
  if (pageCount <= 1) return firstResults;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) =>
      getPage(i + 2).catch(error => {
        console.warn('Failed to fetch BaLabs page', { url: url.href, page: i + 2, error });
        return undefined;
      })
    )
  );

  // Stop at the first gap rather than stitching a hole into the middle of the
  // series — the chart would read the jump as a real move.
  const pages: T[][] = [firstResults];
  for (const page of rest) {
    const results = page?.results ?? [];
    if (results.length === 0) break;
    pages.push(results);
  }

  // The last page can overshoot the caller's budget by up to a page.
  return pages.flat().slice(0, wanted);
}
