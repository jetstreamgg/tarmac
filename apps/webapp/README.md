# DISCLAIMER

THIS webapp SOFTWARE CODE REPOSITORY (“REPOSITORY”) IS MADE AVAILABLE TO YOU BY JETSTREAMGG (“DEVELOPER”). WHILE DEVELOPER GENERATED THE OPEN-SOURCE CODE WITHIN THIS REPOSITORY, DEVELOPER DOES NOT MAINTAIN OR OPERATE ANY SOFTWARE PROTOCOL, PLATFORM, PRODUCT OR SERVICE THAT INCORPORATES SUCH SOURCE CODE.

DEVELOPER MAY, FROM TIME TO TIME, GENERATE, MODIFY AND/OR UPDATE SOURCE CODE WITHIN THIS REPOSITORY BUT IS UNDER NO OBLIGATION TO DO SO. HOWEVER, DEVELOPER WILL NOT PERFORM REPOSITORY MANAGEMENT FUNCTIONS, SUCH AS REVIEWING THIRD-PARTY CONTRIBUTIONS, MANAGING COMMUNITY INTERACTIONS OR HANDLING NON-CODING ADMINISTRATIVE TASKS.

THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY IS OFFERED ON AN “AS-IS,” “AS-AVAILABLE” BASIS WITHOUT ANY REPRESENTATIONS, WARRANTIES OR GUARANTEES OF ANY KIND, EITHER EXPRESS OR IMPLIED. DEVELOPER DISCLAIMS ANY AND ALL LIABILITY FOR ANY ISSUES THAT ARISE FROM THE USE, MODIFICATION OR DISTRIBUTION OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY. PLEASE REVIEW, TEST AND AUDIT ANY SOURCE CODE PRIOR TO MAKING USE OF SUCH SOURCE CODE. BY ACCESSING OR USING ANY SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY, YOU UNDERSTAND, ACKNOWLEDGE AND AGREE TO THE RISKS OF USING THE SOURCE CODE AND THE LIMITED SCOPE OF DEVELOPER’S ROLE AS DESCRIBED HEREIN. YOU AGREE THAT YOU WILL NOT HOLD DEVELOPER LIABLE OR RESPONSIBLE FOR ANY LOSSES OR DAMAGES ARISING FROM YOUR USE OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY.

# Reservation of trademark rights

The materials in this repository may include references to our trademarks as well as trademarks owned by other persons. No rights are granted to you to use any trade names, trademarks, service marks, or product names, whether owned by us or by others, except solely as necessary for reasonable and customary use in describing the origin of the source materials. All trademark rights are expressly reserved by the respective owners.

# Tarmac Webapp

This is a guide to help you set up the Tarmac webapp on your local machine.

## Prerequisites

- Node.js (v20.19 or later)
- pnpm (v10.17 or later, install with `npm install -g pnpm`)

## Setup

1. Clone the repository to your local machine using `git clone <repository-url>`.
2. Navigate into the project directory with `cd <project-directory>`.
3. Install the project dependencies with `pnpm install`.

## Environment Variables

Create a `.env` file in the root directory of the project. You can use the `.env.example` file as a reference for the required environment variables. Fill in the necessary values.

#### RPC and network

- `VITE_PROXY_ORIGIN`: Origin of the Sky RPC/indexer proxy. The app constructs RPC URLs as `${VITE_PROXY_ORIGIN}/rpc/<chainId>` for every supported chain. If you point this at a custom origin, remember to add it to the CSP `connect-src` in `vite.config.ts`
- `VITE_RPC_PROVIDER_TENDERLY`: URL for a Tenderly virtual network RPC endpoint. Used as the dev-mode chain across all modules to test flows and perform free transactions against a forked state
- `VITE_TESTNET_CONFIG`: Boolean flag to determine network config to use, should be `false` in production

#### Authentication and wallet

- `VITE_AUTH_URL`: Base URL for the authentication service
- `VITE_WALLETCONNECT_PROJECT_ID`: Project ID for WalletConnect integration
- `VITE_SKIP_AUTH_CHECK`: Boolean flag to bypass authentication checks during development

#### Geo-restrictions and deployment scoping

- `VITE_GEO_CONFIG_URL`: (Optional) URL for the geo-config endpoint that provides runtime region-based restrictions. Falls back to staging URL if not set
- `VITE_GEO_BYPASS`: Boolean flag to bypass geo-restriction checks during development (assumes no restricted regions and enables all modules)
- `VITE_PRIVATE_HOSTNAMES`: (Optional) Comma-separated list of hostnames treated as private Cloudflare Access-gated deployments

#### Testing

- `TENDERLY_API_KEY`: API key for Tenderly (used for forking and managing virtual networks during e2e tests)
- `VITE_USE_MOCK_WALLET`: Boolean flag to enable the use of a mock wallet for testing purposes

#### Terms of use

- `VITE_TERMS_ENDPOINT`: URL endpoint for submitting and checking terms acceptance
- `VITE_TERMS_LINK`: Array containing links to terms of use
- `VITE_FOOTER_LINKS`: Array containing footer links with their URLs and names
- `VITE_TERMS_MESSAGE_TO_SIGN`: Message that users need to sign to accept the terms and conditions
- `VITE_TERMS_CHECKBOX_TEXT`: The text displayed next to the checkbox in the terms acceptance modal
- `VITE_TERMS_MARKDOWN_FILE`: (Optional) Name of a custom terms markdown file in the `/src/content/` directory (e.g., `/src/content/custom-terms.md`). If not specified, uses the default `terms.md` file. This allows external teams to provide their own terms file that will be bundled into the application

#### Feature flags

- `VITE_BATCH_TX_ENABLED`: Boolean flag to enable the use of EIP-7702 batch transactions in widgets
- `VITE_REFERRAL_CODE`: (Optional) Referral code for the app

#### Environment metadata

- `VITE_ENV_NAME`: (Optional) Environment name (e.g., 'development', 'staging', 'production')
- `VITE_CF_PAGES_COMMIT_SHA`: (Optional) Git commit hash of the current build

#### Sentry

- `VITE_SENTRY_DSN`: (Optional) Public Sentry DSN for browser-side error and performance reporting
- `VITE_SENTRY_ENVIRONMENT`: (Optional) Sentry environment name. If omitted, the app falls back to `VITE_ENV_NAME`, then `development`
- `VITE_SENTRY_RELEASE`: (Optional) Explicit Sentry release identifier. If omitted, the app falls back to `VITE_CF_PAGES_COMMIT_SHA`, then `<package-version>-<environment>`
- `VITE_SENTRY_DEBUG`: (Optional) Set to `'true'` to enable Sentry debug mode and full trace sampling in non-production environments
- `SENTRY_ORG`: (Optional) Sentry organization slug used by the Vite plugin for source map uploads during build
- `SENTRY_PROJECT`: (Optional) Sentry project slug used by the Vite plugin for source map uploads during build
- `SENTRY_AUTH_TOKEN`: (Optional) Build-time auth token for Sentry source map uploads. If omitted, the app still builds and runtime Sentry can still report events, but source maps are not uploaded

#### Analytics

- `VITE_POSTHOG_KEY`: (Optional) PostHog project API key
- `VITE_POSTHOG_HOST`: (Optional) PostHog ingestion host
- `VITE_POSTHOG_ENABLED`: (Optional) Set to `'true'` to enable PostHog analytics
- `VITE_GA_MEASUREMENT_ID`: (Optional) Google Analytics measurement ID

## Running the App

To start the development server, run `pnpm dev`.

The application should now be running at [http://localhost:3000](http://localhost:3000).

## Testing

To run the e2e tests, run `pnpm e2e` or `pnpm e2e:ui` to run in ui mode.

These will fork a tenderly vnet, run the e2e tests, then delete the fork. **You'll need to run node version >=22** and also have the `TENDERLY_API_KEY` environment variable set in your local environment to fork and delete the vnet. Additionally, to run the testing environment locally, set `VITE_USE_MOCK_WALLET=true` in env vars.

The regular mode will automatically run all tests, and then generate a report including recordings of tests, whereas in ui mode, you can select which tests to run in the ui, and watch the tests run in real time.

You can download the [Playwright VS Code](https://playwright.dev/docs/getting-started-vscode) extension and run the tests from VS Code (works with Cursor too). Simply click the button to the left of the test code to run a test individually.

The VS code extension can also help with [generating tests](https://playwright.dev/docs/codegen).

Note that when you try to initiate a transaction using this feature, the transaction will fail because the RPC interception has not been setup to add the gas parameter. You'll run into the same issue if you run `pnpm dev:mock`.

### Running a single test

In addition to the above, you can also run only a single e2e test by passing along an argument for the test file:

`pnpm e2e upgrade.spec.ts`

You will need to have the `TEST_CHAIN` env var set. You can set it locally by entering this command: `export TEST_CHAIN=mainnet`

## Building the App

To build the application for production, run `pnpm build`.

If `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are set at build time, the Vite build will also upload source maps to Sentry. The current initial Sentry integration covers browser errors and router tracing; Session Replay is not enabled in this app.

## Linting and Formatting

To lint the project, use `pnpm lint`.

To format the project, use `pnpm prettier`.

There's also a precommit hook that runs eslint and prettier on all staged files.

## Additional Docs

For more detailed information, you can refer to the following documents in the `docs` folder:

- [User Suggested Actions Construction](docs/generating-user-actions.md): This document explains how the `fetchUserSuggestedActions` function generates personalized actions for users based on their token balances and available reward opportunities.

## Internationalization and Translation

This application supports i18n and translations via the Lingui package. To add content that can be translated, you need to follow three simple steps:

- Wrap the text in `<Trans>` tags, the `t` function or the `msg` function depending on the context.
- Run `pnpm extract` from the root of this repo to extract the messages into `.po` files, which can then be translated.
- Run `pnpm compile` to compile the translations into optimized JavaScript format.

For more information on the i18n process, refer to the [Internationalization and Translation Process](../../README.md#internationalization-and-translation-process) section in the root README and for more information on how Lingui works, refer to the [Lingui documentation](https://lingui.dev/).
