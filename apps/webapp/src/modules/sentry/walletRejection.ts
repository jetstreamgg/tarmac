import type { ErrorEvent } from '@sentry/react';

// Unhandled plain-object rejections from EIP-1193 providers that we can't
// prevent from our side and that carry nothing to debug (no stack, 0 users):
//   - 4001: user rejected request during Wagmi auto-reconnect (WEBAPP-B).
//   - 4900: "provider is disconnected from all chains" — a locked or
//     chain-less extension (seen from Rabby) rejecting wagmi's auto-reconnect
//     probes on page load (WEBAPP-V, WEBAPP-B).
//   - -32601: JSON-RPC "Method not found" — wagmi/viem/RainbowKit
//     speculatively probe optional methods (EIP-5792 capabilities,
//     wallet_watchAsset, etc.) and wallets that don't implement them reject
//     with this code.
//   - -32603: "Internal JSON-RPC error" — the same optional-method probes
//     answered with the generic internal code (WEBAPP-B, WEBAPP-9T, WEBAPP-10).
//   - -32004: "Method not supported" — likewise (WEBAPP-9V).
const DROPPED_WALLET_REJECTION_CODES = new Set([4001, 4900, -32601, -32603, -32004]);

const OBJECT_REJECTION_PREFIX = 'Object captured as promise rejection with keys';

/**
 * Sentry can't title a promise rejected with a plain `{ code, message }` object
 * (it renders `<unknown>`) and gets no stack for it. Drops the known wallet
 * noise and empty-object rejections (WEBAPP-AV), and gives any other
 * plain-object rejection a readable title so an alert on it is legible
 * (APP-436). Every other event passes through untouched.
 */
export function filterWalletRejection(event: ErrorEvent): ErrorEvent | null {
  const exception = event.exception?.values?.find(v => v.value?.includes(OBJECT_REJECTION_PREFIX));
  if (!exception) return event;

  const serialized = event.extra?.__serialized__;
  if (!serialized || typeof serialized !== 'object' || Object.keys(serialized).length === 0) return null;
  const { code, message } = serialized as { code?: unknown; message?: unknown };

  if (typeof code === 'number' && DROPPED_WALLET_REJECTION_CODES.has(code)) return null;

  const title = [message, code !== undefined && `(${code})`].filter(Boolean).join(' ');
  if (title) {
    exception.type = 'UnhandledWalletRejection';
    exception.value = title;
  }
  return event;
}
