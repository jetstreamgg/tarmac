# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tarmac is a React-based Web3 DeFi application for interacting with the Sky/Maker protocol. The webapp lives at `apps/webapp/` and is the sole product of this repo.

## Essential Commands

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

### Security audit

```bash
pnpm audit --prod --audit-level high   # Audit runtime deps; fails on high/critical
```

`pnpm audit`'s `dev` flag is unreliable in workspaces. CI uses `pnpm audit --prod --audit-level high` to audit only the runtime dependency trees.

## Development Patterns

### React Components

- Component files: PascalCase (e.g., `Button.tsx`)
- Props type: `ComponentNameProps`
- Hooks: camelCase (e.g., `useWallet.ts`)

### TypeScript

- Hand-authored type files use `.ts`, not `.d.ts`. `skipLibCheck` makes TypeScript skip type-checking `.d.ts` contents, so exported types defined there go unchecked. Reserve `.d.ts` for genuine ambient declarations like `vite-env.d.ts`.

### Testing

- Use Tenderly forks for consistent test environments

## Adding Features

See the `adding-features` skill (`.claude/skills/adding-features/SKILL.md`) for the steps to add a new smart contract, widget, or webapp module.

## Environment Setup

- Node.js v24+ required
- pnpm v11.5.0+ required
- Key environment variables:
  - `TENDERLY_API_KEY` - For test network forking
  - `MAINNET_FORK_CONTAINER_ID` - Tenderly mainnet parent vnet for `pnpm vnet:fork` (default in `.env.example`)
  - `VITE_PROXY_ORIGIN` - Origin of the Sky RPC/indexer proxy (RPC URLs are built as `${VITE_PROXY_ORIGIN}/rpc/<chainId>`)
  - `VITE_RPC_PROVIDER_TENDERLY` - Tenderly virtual network RPC used as the dev-mode chain across all modules
  - `VITE_WALLETCONNECT_PROJECT_ID` - Wallet connection
  - `VITE_USE_MOCK_WALLET` - Testing mode

## Git Commit Guidelines

- Do not include "Co-Authored-By" or any AI attribution in commit messages
- Keep commit messages concise and focused on what changed
