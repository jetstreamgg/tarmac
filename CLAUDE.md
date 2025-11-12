# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tarmac is a React-based Web3 DeFi application for interacting with the Sky/Maker protocol. It's structured as a monorepo using pnpm workspaces with the main webapp and reusable packages.

## Essential Commands

### Development

```bash
pnpm install          # Install all dependencies
pnpm dev             # Start dev server (port 3000)
pnpm dev:packages    # Run packages in watch mode
pnpm dev:mock        # Development with mock wallet
```

### Testing

```bash
pnpm test            # Run all unit tests
pnpm test:watch      # Run tests in watch mode
pnpm test:coverage   # Run tests with coverage
pnpm e2e             # Run E2E tests with Tenderly fork
pnpm e2e:ui         # Run E2E tests with UI (interactive)
```

### Code Quality

```bash
pnpm lint            # Run ESLint
pnpm typecheck       # Run TypeScript type checking
pnpm prettier        # Format code
```

### Build

```bash
pnpm build           # Build all packages and webapp
pnpm build:packages  # Build packages only
```

### i18n

```bash
pnpm messages        # Extract and compile translations
```

## Architecture

### Monorepo Structure

- `/apps/webapp/` - Main React application
- `/packages/`
  - `hooks/` - React hooks for Web3 interactions (Wagmi-based)
  - `widgets/` - Self-contained UI components for protocol features
  - `utils/` - Shared utilities and helpers
  - `contracts/` - Smart contract ABIs and addresses
  - `ui/` - Core UI component library

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

1. Add contract to `/packages/contracts/src/contracts.ts`
2. Run `pnpm -F hooks generate` to generate types
3. Create hooks in `/packages/hooks/` for contract interactions

### New Widget

1. Create in `/packages/widgets/src/`
2. Follow existing widget patterns with `WidgetProps` interface
3. Export from package index
4. Add tests and documentation

### New Webapp Feature

1. Create module in `/apps/webapp/src/modules/`
2. Add routes in `/apps/webapp/src/pages/`
3. Use existing hooks and components
4. Add i18n messages with `<Trans>` tags

## Environment Setup

- Node.js v20.19+ required (Vite 7 requires 20.19+ or 22.12+)
- pnpm v10.17.0+ required
- Key environment variables:
  - `TENDERLY_API_KEY` - For test network forking
  - `VITE_RPC_PROVIDER_*` - RPC endpoints
  - `VITE_WALLETCONNECT_PROJECT_ID` - Wallet connection
  - `VITE_USE_MOCK_WALLET` - Testing mode
