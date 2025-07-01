# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build and Development
```bash
# Install dependencies (must use pnpm)
pnpm install

# Run development server (webapp on port 3000)
pnpm dev

# Build all packages and apps
pnpm build

# Build only packages
pnpm build:packages

# Run development mode for packages (with watch)
pnpm dev:packages

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Prettier formatting
pnpm prettier
```

### Testing
```bash
# Run all tests (unit tests + hooks tests with Tenderly fork)
pnpm test

# Run tests for specific package
pnpm test:hooks    # Tests with Tenderly testnet fork
pnpm test:widgets  # Widget package tests
pnpm test:utils    # Utils package tests

# Run tests with coverage
pnpm test:coverage

# E2E tests (Playwright)
pnpm e2e          # Run E2E tests with Tenderly fork
pnpm e2e:ui       # Open Playwright UI mode
```

### Tenderly Virtual Networks (for testing)
```bash
# Fork a new testnet
pnpm vnet:fork

# Delete current testnet
pnpm vnet:delete

# Delete all local testnets
pnpm vnet:delete:all
```

### Internationalization
```bash
# Extract and compile i18n messages
pnpm messages

# Extract messages only
pnpm messages:extract

# Compile messages only
pnpm messages:compile
```

### Changeset Management (for maintainers)
```bash
# Create a changeset for package updates
pnpm changeset

# Update package versions based on changesets
pnpm changeset version

# Publish packages to NPM
pnpm changeset:release
```

## High-Level Architecture

### Monorepo Structure
Tarmac is a PNPM workspace monorepo with three main areas:

1. **apps/webapp**: The main Web3 dApp that serves as the user interface
2. **packages/**: Reusable packages that can be published to NPM
   - **hooks**: React hooks for Sky protocol interactions
   - **widgets**: Self-contained UI widgets for different protocol features
   - **utils**: Shared utilities and helpers

### Key Architectural Patterns

#### 1. Intent-Based Module System
The application is organized around user "intents" (BALANCES, REWARDS, SAVINGS, TRADE, UPGRADE, SEAL, STAKE). Each intent maps to a specific widget that handles all related functionality.

#### 2. Three-Pane Layout
- **Widget Pane**: Main interaction area where users perform actions
- **Details Pane**: Additional information and context
- **Chat Pane**: AI assistant (conditionally displayed based on availability)

#### 3. URL-Driven Configuration
The application state is largely driven by URL parameters:
- `widget`: Current active module
- `network`: Selected blockchain network
- `widgetRoute`: Sub-routes within widgets
- Various widget-specific parameters

#### 4. Multi-Chain Support
The app supports multiple chains (Ethereum, Arbitrum, Base, Optimism, Unichain) with chain-specific features and configurations.

#### 5. Context-Based State Management
Primary contexts:
- **ConfigContext**: Global configuration and feature flags
- **ChatContext**: AI assistant state
- **ConnectedContext**: Wallet connection state
- **BalanceFiltersContext**: Asset filtering preferences
- **ChainModalContext/TermsModalContext**: Modal management

#### 6. Widget Architecture
Each widget follows a consistent pattern:
- Self-contained with its own components, hooks, and types
- Transaction flow components (input → review → status)
- Integration with the global layout through standard interfaces
- Chain-specific feature support

#### 7. Data Fetching Strategy
- **React Query**: For all async data management
- **Subgraph Queries**: Historical blockchain data via GraphQL
- **Direct Contract Reads**: Real-time data via wagmi/viem
- **Polling**: For real-time updates where needed

### Development Considerations

1. **TypeScript First**: All code should be properly typed
2. **Component Patterns**: Follow existing patterns for consistency
3. **Error Handling**: Use error boundaries and proper error states
4. **Testing**: Write tests for new functionality, especially in packages
5. **Internationalization**: Use Lingui for all user-facing text
6. **Restricted Builds**: Be aware of compliance-related feature flags

### Environment Variables
Key environment variables to be aware of:
- `TENDERLY_API_KEY`: Required for running tests with Tenderly forks
- `VITE_RESTRICTED_BUILD`: Enables restricted mode (limited features)
- `VITE_USE_MOCK_WALLET`: Enables mock wallet for development
- Various `VITE_*_SUBGRAPH_URL`: Subgraph endpoints for different chains

### Widget Development
When creating or modifying widgets:
1. Follow the existing widget structure in `packages/widgets/src`
2. Ensure proper integration with the widget routing system
3. Handle all transaction states (input, review, pending, success, error)
4. Support chain-specific features appropriately
5. Use shared UI components from the widgets package
6. Integrate with the global contexts as needed