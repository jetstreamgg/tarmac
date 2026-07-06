/**
 * Runtime polyfills for legacy browsers, imported first in pages/main.tsx so
 * they run before any dependency code evaluates.
 *
 * `Object.hasOwn` (ES2022) is missing from older engines — notably pre-2021
 * Android WebViews / in-app browsers. wagmi's structural-equality helper calls
 * it on every connection-state comparison, so on those browsers the wallet
 * connection layer throws an unhandled rejection (Sentry WEBAPP-8G). Vendored
 * deps aren't transpiled, so we shim the builtin here.
 */
if (!Object.hasOwn) {
  Object.defineProperty(Object, 'hasOwn', {
    value: (object: object, property: PropertyKey) => Object.prototype.hasOwnProperty.call(object, property),
    configurable: true,
    writable: true
  });
}
