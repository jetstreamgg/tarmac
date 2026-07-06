# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tarmac is a React-based Web3 DeFi application for interacting with the Sky/Maker protocol. The webapp lives at `apps/webapp/` and is the sole product of this repo.

## Essential Commands

### Development

```bash
pnpm install          # Install all dependencies
pnpm dev             # Start dev server (port 3000)
pnpm dev:mock        # Development with mock wallet
```

### Testing

```bash
pnpm test            # Run fast webapp unit suite + vnet-backed hooks suite
pnpm test:hooks      # Run only the vnet-backed hooks suite (wraps Tenderly fork lifecycle)
pnpm test:coverage   # Run tests with coverage (vnet-wrapped)
pnpm e2e             # Run E2E tests with Tenderly fork
pnpm e2e:ui         # Run E2E tests with UI (interactive)
```

### Code Quality

```bash
pnpm lint            # Run ESLint
pnpm typecheck       # Run TypeScript type checking
pnpm prettier        # Format (writes) every file in the repo. Appended path args are ignored — it always targets "."
pnpm prettier:check  # Check formatting without writing. Same caveat: always checks "."

# To check/write a narrow path, bypass the script and hit the binary directly:
# pnpm exec prettier --check <path>
# pnpm exec prettier --write <path>
```

### Build

```bash
pnpm build           # Build the webapp (runs `pnpm messages` first)
```

### Security audit

```bash
pnpm audit --prod --audit-level high   # Audit runtime deps; fails on high/critical
```

`pnpm audit`'s `dev` flag is unreliable in workspaces. CI uses `pnpm audit --prod --audit-level high` to audit only the runtime dependency trees.

### i18n

```bash
pnpm messages        # Extract and compile translations
```

## Architecture

### Repo Layout

- `/apps/webapp/` - The React application (the only product of this repo).
  - `src/hooks/` - React hooks for Web3 interactions (Wagmi-based). Includes wagmi-generated `generated.ts`.
  - `src/widgets/` - Self-contained UI components for protocol features.
  - `src/utils/` - Shared utilities and helpers.
  - `src/modules/` - Webapp modules (see below).
  - `wagmi.config.ts` + `generate-with-retry.js` - Wagmi codegen config and retry wrapper.
- `/apps/webapp/test/hooks/` - Test helpers + global setup for the vnet-backed hooks suite.

### Key Webapp Modules (`/apps/webapp/src/modules/`)

- `trade/` - Trading interface with Sky Protocol
- `savings/` - USDS savings functionality
- `rewards/` - Token rewards claiming
- `stake/` - MKR/SKY staking features
- `seal/` - Seal protocol integration
- `upgrade/` - MKR to SKY token migration
- `balances/` - Wallet balance management
- `auth/` - Authentication and wallet connection

### Tech Stack

- **Frontend**: React 19, TypeScript 5.8
- **Web3**: Wagmi, Viem, RainbowKit
- **State**: TanStack Query, React Context
- **Styling**: Tailwind CSS v4, Radix UI
- **Build**: Vite 6.3
- **Testing**: Vitest (unit), Playwright (E2E)
- **i18n**: Lingui

## Development Patterns

### React Components

- Use functional components with TypeScript
- Component files: PascalCase (e.g., `Button.tsx`)
- Props type: `ComponentNameProps`
- Hooks: camelCase (e.g., `useWallet.ts`)
- Tests: kebab-case (e.g., `button-test.tsx`)

### TypeScript

- Hand-authored type files use `.ts`, not `.d.ts`. `skipLibCheck` makes TypeScript skip type-checking `.d.ts` contents, so exported types defined there go unchecked. Reserve `.d.ts` for genuine ambient declarations like `vite-env.d.ts`.

### Web3 Integration

- Use Wagmi hooks for contract interactions
- Handle transaction lifecycle (pending, success, error)
- Provide user-friendly error messages
- Use generated contract types from ABIs

### Styling

- Use Tailwind CSS classes
- Radix UI for accessible primitives
- class-variance-authority for component variants
- CSS variables for theming

### Testing

- Unit tests alongside source files (`.test.ts(x)`)
- Mock blockchain calls appropriately
- Use Tenderly forks for consistent test environments
- E2E tests in `/apps/webapp/src/test/e2e/tests`

## Adding Features

### New Smart Contract

1. Add contract address and ABI to `apps/webapp/src/hooks/contracts.ts` (mainnet contracts go in the `contracts` array; L2 contracts go in the `l2Contracts` array in the same file), re-exporting from `apps/webapp/src/hooks/index.ts` as needed.
2. Run `pnpm -F webapp generate` to regenerate `apps/webapp/src/hooks/generated.ts`. Use `pnpm -F webapp generate:retry` to retry on flakey Etherscan responses.
3. Create the hook in the appropriate subfolder of `apps/webapp/src/hooks/`.

### New Widget

1. Create the widget in `apps/webapp/src/widgets/<WidgetName>/`.
2. Follow existing widget patterns with `WidgetProps` interface.
3. Re-export from `apps/webapp/src/widgets/index.ts` if it needs a barrel entry.
4. Add tests alongside the source and documentation if relevant.

### New Webapp Feature

1. Create module in `apps/webapp/src/modules/`.
2. Add routes in `apps/webapp/src/pages/`.
3. Use existing hooks and components.
4. Add i18n messages with `<Trans>` tags.

## Environment Setup

- Node.js v24+ required
- pnpm v11.5.0+ required
- Key environment variables:
  - `TENDERLY_API_KEY` - For test network forking
  - `VITE_PROXY_ORIGIN` - Origin of the Sky RPC/indexer proxy (RPC URLs are built as `${VITE_PROXY_ORIGIN}/rpc/<chainId>`)
  - `VITE_RPC_PROVIDER_TENDERLY` - Tenderly virtual network RPC used as the dev-mode chain across all modules
  - `VITE_WALLETCONNECT_PROJECT_ID` - Wallet connection
  - `VITE_USE_MOCK_WALLET` - Testing mode

## Git Commit Guidelines

- Do not include "Co-Authored-By" or any AI attribution in commit messages
- Keep commit messages concise and focused on what changed
