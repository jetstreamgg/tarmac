---
name: adding-features
description: Step-by-step conventions for adding a new smart contract, widget, or webapp feature to the tarmac webapp. Use when wiring up a new contract/ABI, creating a widget under src/widgets/, or scaffolding a new module under src/modules/.
---

# Adding Features

## New Smart Contract

1. Add contract address and ABI to `apps/webapp/src/hooks/contracts.ts` (mainnet contracts go in the `contracts` array; L2 contracts go in the `l2Contracts` array in the same file), re-exporting from `apps/webapp/src/hooks/index.ts` as needed.
2. Run `pnpm -F webapp generate` to regenerate `apps/webapp/src/hooks/generated.ts`. Use `pnpm -F webapp generate:retry` to retry on flakey Etherscan responses.
3. Create the hook in the appropriate subfolder of `apps/webapp/src/hooks/`.

## New Widget

1. Create the widget in `apps/webapp/src/widgets/<WidgetName>/`.
2. Follow existing widget patterns with `WidgetProps` interface.
3. Re-export from `apps/webapp/src/widgets/index.ts` if it needs a barrel entry.
4. Add tests alongside the source and documentation if relevant.

## New Webapp Feature

1. Create module in `apps/webapp/src/modules/`.
2. Add routes in `apps/webapp/src/pages/`.
3. Use existing hooks and components.
4. Add i18n messages with `<Trans>` tags.
