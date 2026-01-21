# DISCLAIMER

THIS webapp SOFTWARE CODE REPOSITORY (“REPOSITORY”) IS MADE AVAILABLE TO YOU BY JETSTREAMGG (“DEVELOPER”). WHILE DEVELOPER GENERATED THE OPEN-SOURCE CODE WITHIN THIS REPOSITORY, DEVELOPER DOES NOT MAINTAIN OR OPERATE ANY SOFTWARE PROTOCOL, PLATFORM, PRODUCT OR SERVICE THAT INCORPORATES SUCH SOURCE CODE.

DEVELOPER MAY, FROM TIME TO TIME, GENERATE, MODIFY AND/OR UPDATE SOURCE CODE WITHIN THIS REPOSITORY BUT IS UNDER NO OBLIGATION TO DO SO. HOWEVER, DEVELOPER WILL NOT PERFORM REPOSITORY MANAGEMENT FUNCTIONS, SUCH AS REVIEWING THIRD-PARTY CONTRIBUTIONS, MANAGING COMMUNITY INTERACTIONS OR HANDLING NON-CODING ADMINISTRATIVE TASKS.

THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY IS OFFERED ON AN “AS-IS,” “AS-AVAILABLE” BASIS WITHOUT ANY REPRESENTATIONS, WARRANTIES OR GUARANTEES OF ANY KIND, EITHER EXPRESS OR IMPLIED. DEVELOPER DISCLAIMS ANY AND ALL LIABILITY FOR ANY ISSUES THAT ARISE FROM THE USE, MODIFICATION OR DISTRIBUTION OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY. PLEASE REVIEW, TEST AND AUDIT ANY SOURCE CODE PRIOR TO MAKING USE OF SUCH SOURCE CODE. BY ACCESSING OR USING ANY SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY, YOU UNDERSTAND, ACKNOWLEDGE AND AGREE TO THE RISKS OF USING THE SOURCE CODE AND THE LIMITED SCOPE OF DEVELOPER’S ROLE AS DESCRIBED HEREIN. YOU AGREE THAT YOU WILL NOT HOLD DEVELOPER LIABLE OR RESPONSIBLE FOR ANY LOSSES OR DAMAGES ARISING FROM YOUR USE OF THE SOURCE CODE MADE AVAILABLE VIA THIS REPOSITORY.

# Reservation of trademark rights

The materials in this repository may include references to our trademarks as well as trademarks owned by other persons. No rights are granted to you to use any trade names, trademarks, service marks, or product names, whether owned by us or by others, except solely as necessary for reasonable and customary use in describing the origin of the source materials. All trademark rights are expressly reserved by the respective owners.

# Phase One App

This is a guide to help you set up the Phase One App project on your local machine.

## Prerequisites

- Node.js (v18 or later)
- pnpm (install with `npm install -g pnpm`)

## Setup

1. Clone the repository to your local machine using `git clone <repository-url>`.
2. Navigate into the project directory with `cd <project-directory>`.
3. Install the project dependencies with `pnpm install`.

## Environment Variables

Create a `.env` file in the root directory of the project. You can use the `.env.example` file as a reference for the required environment variables. Fill in the necessary values.

- `VITE_RPC_PROVIDER_MAINNET`: URL for the Ethereum mainnet RPC provider
- `VITE_RPC_PROVIDER_TENDERLY`: URL for the Tenderly RPC provider (used for testing and development)
- `VITE_RPC_PROVIDER_BASE`: URL for the Base RPC provider
- `VITE_RPC_PROVIDER_ARBITRUM`: URL for the Arbitrum RPC provider
- `VITE_RPC_PROVIDER_OPTIMISM`: URL for the Optimism RPC provider
- `VITE_RPC_PROVIDER_UNICHAIN`: URL for the Unichain provider
- `VITE_TESTNET_CONFIG`: Boolean flag to determine network config to use, should be `false` in production
- `VITE_AUTH_URL`: Base URL for the authentication service
- `VITE_RESTRICTED_BUILD`: Boolean flag to enable certain restrictions
- `VITE_RESTRICTED_BUILD_MICA`: Boolean flag to enable certain restrictions for MiCa compliance
- `VITE_WALLETCONNECT_PROJECT_ID`: Project ID for WalletConnect integration
- `VITE_SKIP_AUTH_CHECK`: Boolean flag to bypass authentication checks during development
- `VITE_SKIP_CHAT_AUTH_CHECK`: Boolean flag to bypass chatbot terms acceptance check during testing (only works in non-production environments)
- `TENDERLY_API_KEY`: API key for Tenderly (used for forking and managing virtual networks for testing)
- `VITE_USE_MOCK_WALLET`: Boolean flag to enable the use of a mock wallet for testing purposes
- `VITE_TERMS_ENDPOINT`: URL endpoint for submitting and checking terms acceptance
- `VITE_TERMS_LINK`: Array containing links to terms of use
- `VITE_FOOTER_LINKS`: Array containing footer links with their URLs and names
- `VITE_TERMS_MESSAGE_TO_SIGN`: Message that users need to sign to accept the terms and conditions
- `VITE_TERMS_CHECKBOX_TEXT`: The text displayed next to the checkbox in the terms acceptance modal
- `VITE_TERMS_MARKDOWN_FILE`: (Optional) Name of a custom terms markdown file in the `/src/content/` directory (e.g., `/src/content/custom-terms.md`). If not specified, uses the default `terms.md` file. This allows external teams to provide their own terms file that will be bundled into the application
- `VITE_BATCH_TX_ENABLED`: Boolean flag to enable the use of EIP-7702 batch transactions in widgets
- `VITE_ENV_NAME`: (Optional) Environment name (e.g., 'development', 'staging', 'production')
- `VITE_CF_PAGES_COMMIT_SHA`: (Optional) Git commit hash of the current build
- `VITE_REFERRAL_CODE`: (Optional) Referral code for the app
- `VITE_CHATBOT_TERMS_MARKDOWN_FILE`: (Optional) Name of a custom chatbot terms markdown file in the `/src/content/` directory (e.g., `/src/content/custom-chatbot-terms.md`). If not specified, uses the default `chatbot_terms.md` file. This allows external teams to provide their own chatbot-specific terms file
- `VITE_CHATBOT_ENABLED`: If set to `'true'`, enables the chatbot functionality
- `VITE_CHATBOT_FEEDBACK_ENABLED`: If set to `'true'`, enables the chatbot feedback functionality
- `VITE_CHATBOT_USE_TESTNET_NETWORK_NAME`: If set to `'true'` replaces network names for their testnet counterpart. Only in development or staging.
- `VITE_CHATBOT_SUGGESTIONS_ENABLED`: Chat suggestions are enabled by default. Set to `'false'` to disable
- `VITE_CHATBOT_NAME`: The name of the chatbot
- `VITE_CHATBOT_DOMAIN`: The base URL for the chatbot backend API
- `VITE_CHATBOT_MAX_HISTORY`: Maximum number of previous messages to include in chat context.
- `VITE_CHATBOT_MAX_MESSAGE_LENGTH`: Maximum character length for user input messages.
- `VITE_CHATBOT_CF_ACCESS_CLIENT_ID`: (Optional) Cloudflare Access client ID for authentication headers in development/staging environments
- `VITE_CHATBOT_CF_ACCESS_CLIENT_SECRET`: (Optional) Cloudflare Access client secret for authentication headers in development/staging environments
- `VITE_CHATBOT_SUGGESTED_QUESTIONS`: (Optional) Array of suggested questions displayed when the chatbot first loads (e.g., `'["Question 1", "Question 2"]'`). If not provided, default questions will be shown
- `VITE_CHATBOT_CHECKBOX_LABEL`: (Optional) Additional instructional text displayed above the terms acceptance checkboxes in the chatbot terms modal.
- `VITE_CHATBOT_CHECKBOX_TERMS_LABEL`: (Optional) Custom label for the terms checkbox in the chatbot terms modal. Supports markdown formatting.
- `VITE_CHATBOT_CHECKBOX_PRIVACY_LABEL`: (Optional) Custom label for the privacy checkbox in the chatbot terms modal. Supports markdown formatting.
- `VITE_CHATBOT_PREFILL_FILTERING_ENABLED`: Controls whether chatbot intents with pre-filled amounts/tokens are filtered. Filtering is enabled by default unless explicitly set to `'false'`.

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
