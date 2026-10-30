import { type BrowserContext } from '@playwright/test';

/** The localStorage key prefix of the app's pending bridge store. */
export const PENDING_BRIDGE_KEY_PREFIX = 'bridgePending:v1:';

/** Mock builds clear localStorage on every load (config.e2e.ts); this keeps the pending bridges, as a real reload does. */
export const keepPendingBridgesOnLoad = (context: BrowserContext) =>
  context.addInitScript(prefix => {
    Storage.prototype.clear = function (this: Storage) {
      for (const key of Object.keys(this)) if (!key.startsWith(prefix)) this.removeItem(key);
    };
  }, PENDING_BRIDGE_KEY_PREFIX);
