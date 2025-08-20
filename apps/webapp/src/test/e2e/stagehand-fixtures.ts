import { test as baseTest } from './fixtures';
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
  extract?: (instruction: string) => Promise<any>;
}

type StagehandFixture = {
  stagehand: Stagehand | null;
  stagehandPage: StagehandPage;
};

// Extend your existing test fixtures with Stagehand capabilities
// This ensures we inherit all the critical setup: EVM snapshots, network setup,
// token funding, route mocking, worker management, etc.
export const test = baseTest.extend<StagehandFixture>({
  stagehand: [
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async ({ browserName: _browserName }, use) => {
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
        // This is critical for DeFi tests that need RPC and VPN mocking
        await activePage.route('https://virtual.**.rpc.tenderly.co/**', mockRpcCalls);
        await activePage.route('**/ip/status?ip=*', mockVpnCheck);

        // Set worker index like the base fixtures do
        process.env.VITE_TEST_WORKER_INDEX = String(workerInfo.workerIndex);

        // CRITICAL: Ensure mock wallet is enabled for Stagehand
        // Since import.meta.env.VITE_USE_MOCK_WALLET is set at build time,
        // we need to intercept the page response and inject the mock wallet logic
        await activePage.route('**/*', async (route, request) => {
          // If this is the main HTML page
          if (
            request.url().includes('localhost:3000') &&
            (request.resourceType() === 'document' || request.url().endsWith('/'))
          ) {
            const response = await route.fetch();
            let body = await response.text();

            // Inject a script to override the mock wallet detection
            const mockWalletScript = `
            <script>
              // Override import.meta.env for mock wallet in Stagehand tests
              window.__VITE_MOCK_WALLET_OVERRIDE__ = true;
              
              // Also set up a global flag that the app can check
              window.FORCE_MOCK_WALLET = true;
            </script>
            `;

            // Insert the script before the closing head tag
            body = body.replace('</head>', mockWalletScript + '</head>');

            route.fulfill({
              response,
              body,
              headers: {
                ...response.headers(),
                'content-type': 'text/html'
              }
            });
          } else {
            // For all other requests, just continue normally
            route.continue();
          }
        });
      } else {
        // Use regular Playwright page (already has route mocking from base fixtures)
        activePage = page;
      }

      await use(activePage);
    },
    { scope: 'test' }
  ]
});

export { expect } from './fixtures';

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
  return 'act' in page && typeof page.act === 'function';
}
