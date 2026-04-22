// Hostnames treated as "private" (Cloudflare Access-gated) deployments where
// VPN + geo checks should be bypassed. Set via VITE_PRIVATE_HOSTNAMES as a
// comma-separated list (e.g. "app-private.sky.money"). If unset, no bypass
// applies — failing closed is the safe default.
const PRIVATE_HOSTNAMES = new Set(
  (import.meta.env.VITE_PRIVATE_HOSTNAMES ?? '')
    .split(',')
    .map((h: string) => h.trim())
    .filter(Boolean)
);

export function isPrivateDeployment(): boolean {
  if (typeof window === 'undefined') return false;
  return PRIVATE_HOSTNAMES.has(window.location.hostname);
}
