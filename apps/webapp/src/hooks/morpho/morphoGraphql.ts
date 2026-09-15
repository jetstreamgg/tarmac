import { MORPHO_API_URL } from './constants';

/**
 * POST one GraphQL document to the Morpho API. A non-2xx status throws; the
 * body is returned as-is (including any `errors` member) so each caller keeps
 * its own view of a partial response.
 */
export async function morphoGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  return (await response.json()) as T;
}
