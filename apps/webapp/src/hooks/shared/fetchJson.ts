/**
 * GET a JSON document with the request shape every REST read hook uses.
 *
 * Mirrors the historical behaviour of those hooks: a non-2xx response is NOT
 * an error by default — its body is parsed like any other, and the caller's
 * own try/catch decides the fallback. `requireOk` opts into throwing
 * `<label> error: <status>` instead (the Merkl clients' contract).
 */
export async function fetchJson<T>(
  url: string | URL,
  { label, requireOk = false }: { label: string; requireOk?: boolean }
): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (requireOk && !response.ok) {
    throw new Error(`${label} error: ${response.status}`);
  }
  return (await response.json()) as T;
}
