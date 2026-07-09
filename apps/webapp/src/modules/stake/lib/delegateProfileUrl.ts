/**
 * Delegate metadata is attacker-controllable — any address can register as a
 * delegate and publish arbitrary profile fields through the subgraph — so the
 * external profile link only passes through http(s) URLs. Anything else
 * (javascript:, data:, protocol-relative, malformed) falls back to the
 * delegate's vote.sky.money profile.
 */
export function delegateProfileUrl(externalProfileURL: string | undefined, delegateAddress: string): string {
  const fallback = `https://vote.sky.money/address/${delegateAddress.toLowerCase()}`;
  if (!externalProfileURL) return fallback;
  try {
    const { protocol } = new URL(externalProfileURL);
    if (protocol === 'http:' || protocol === 'https:') return externalProfileURL;
  } catch {
    // Not an absolute URL — fall through to the fallback.
  }
  return fallback;
}
