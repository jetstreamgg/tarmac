import { test as baseTest, expect } from './fixtures';
import { Stagehand } from '@browserbasehq/stagehand';
import type { Page } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockRpcCalls } from './mock-rpc-call';
import { mockVpnCheck } from './mock-vpn-check';

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.stagehand file if it exists
const envPath = path.join(__dirname, '../../../.env.stagehand');
try {
  dotenvConfig({ path: envPath });
} catch {
  // .env.stagehand file doesn't exist, which is fine
}

// Extended page type with Stagehand capabilities
export interface StagehandPage extends Page {
  act?: (action: string, options?: any) => Promise<any>;
  extract?: (instruction: string | { instruction: string; schema?: any }) => Promise<any>;
}

type StagehandFixture = {
  stagehand: Stagehand | null;
  stagehandPage: StagehandPage;
};

// Extend your existing test fixtures with Stagehand capabilities
// This ensures we inherit all the critical setup: EVM snapshots, network setup,
// token funding, route mocking, worker management, etc.
export const test = baseTest.extend<StagehandFixture>({
  // Note: All base fixtures (snapshotId, autoTestFixture, page with mocking) are inherited automatically
  // We just add Stagehand on top of them

  stagehand: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      // Check if Stagehand should be enabled
      const useStagehand = process.env.USE_STAGEHAND === 'true';

      if (!useStagehand) {
        await use(null);
        return;
      }

      // Determine environment mode
      const env = process.env.STAGEHAND_ENV || 'LOCAL';

      // Build configuration based on environment
      const config: any = {
        env: env as 'LOCAL' | 'BROWSERBASE'
      };

      // Add common configuration
      if (process.env.STAGEHAND_VERBOSE) {
        config.verbose = parseInt(process.env.STAGEHAND_VERBOSE, 10);
      }

      config.enableCaching = process.env.STAGEHAND_ENABLE_CACHE !== 'false';

      if (process.env.STAGEHAND_DEBUG === 'true') {
        config.logger = (logLine: any) => {
          console.log(`[${logLine.category}] ${logLine.message}`);
        };
      }

      // Model configuration
      const modelName = process.env.STAGEHAND_MODEL || 'gpt-4o';
      const modelApiKey = process.env.OPENAI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      if (modelName) {
        config.modelName = modelName;
      }

      if (modelApiKey) {
        config.modelClientOptions = {
          apiKey: modelApiKey
        };
      }

      // BrowserBase configuration (if using BROWSERBASE env)
      if (env === 'BROWSERBASE') {
        const apiKey = process.env.BROWSERBASE_API_KEY;
        const projectId = process.env.BROWSERBASE_PROJECT_ID;

        if (!apiKey || !projectId) {
          console.warn(
            'BROWSERBASE environment selected but API keys not provided. ' + 'Falling back to LOCAL mode.'
          );
          config.env = 'LOCAL';
        } else {
          config.apiKey = apiKey;
          config.projectId = projectId;

          // Optional: Resume existing session
          if (process.env.BROWSERBASE_SESSION_ID) {
            config.browserbaseSessionID = process.env.BROWSERBASE_SESSION_ID;
          }
        }
      }

      // Local browser configuration (if using LOCAL env)
      if (config.env === 'LOCAL') {
        config.localBrowserLaunchOptions = {
          headless: process.env.STAGEHAND_HEADLESS !== 'false'
        };

        // Add viewport configuration
        if (process.env.STAGEHAND_VIEWPORT_WIDTH && process.env.STAGEHAND_VIEWPORT_HEIGHT) {
          config.localBrowserLaunchOptions.viewport = {
            width: parseInt(process.env.STAGEHAND_VIEWPORT_WIDTH, 10),
            height: parseInt(process.env.STAGEHAND_VIEWPORT_HEIGHT, 10)
          };
        }

        // Development mode options
        if (process.env.STAGEHAND_DEVTOOLS === 'true') {
          config.localBrowserLaunchOptions.devtools = true;
        }

        if (process.env.STAGEHAND_SLOWMO) {
          config.localBrowserLaunchOptions.slowMo = parseInt(process.env.STAGEHAND_SLOWMO, 10);
        }
      }

      // Initialize Stagehand
      const stagehand = new Stagehand(config);
      await stagehand.init();

      // Use Stagehand for the test
      await use(stagehand);

      // Cleanup
      await stagehand.close();
    },
    { scope: 'test' }
  ],

  stagehandPage: [
    async ({ stagehand, page }, use, workerInfo) => {
      let activePage: StagehandPage;

      if (stagehand) {
        // Use Stagehand's page
        activePage = stagehand.page;

        // Apply the same route mocking that the base fixtures apply
        // This ensures RPC calls and VPN checks work correctly
        await activePage.route('https://virtual.**.rpc.tenderly.co/**', mockRpcCalls);
        await activePage.route('**/ip/status?ip=*', mockVpnCheck);

        // Ensure worker index is set (important for wallet selection)
        // The base fixtures already set this for the regular page,
        // but we need to ensure it's set for Stagehand tests too
        process.env.VITE_TEST_WORKER_INDEX = String(workerInfo.workerIndex);
      } else {
        // Use regular Playwright page (which already has all base fixture setup)
        activePage = page;
      }

      await use(activePage);
    },
    { scope: 'test' }
  ]
});

// Re-export expect from base fixtures
export { expect };

// Helper function to check if Stagehand is available
export function isStagehandEnabled(): boolean {
  return process.env.USE_STAGEHAND === 'true';
}

// Helper function to check environment mode
export function getStagehandMode(): 'LOCAL' | 'BROWSERBASE' | 'DISABLED' {
  if (process.env.USE_STAGEHAND !== 'true') {
    return 'DISABLED';
  }
  return (process.env.STAGEHAND_ENV || 'LOCAL') as 'LOCAL' | 'BROWSERBASE';
}

// Type guard to check if a page has Stagehand capabilities
export function hasStagehandCapabilities(page: Page | StagehandPage): page is StagehandPage {
  // Check if the methods exist as properties (even non-enumerable ones)
  // Stagehand adds these as non-enumerable properties, so 'in' doesn't work
  return typeof (page as any).act === 'function' && typeof (page as any).extract === 'function';
}
