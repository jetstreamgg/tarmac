# `ProductDetailTemplate` — frozen slot contract (C3)

`ProductDetailTemplate` is the reusable product-detail layout introduced by **C3 — "the gate"**
(Track C). Every Earn product (Savings, Vaults, Rewards, Pendle, Expert), the Portfolio consumers,
and Stake render their detail screens through this single template.

> **Frozen at C3 acceptance** (Migration Mechanics & Component Conventions §5). The slot/props
> interface below is the contract consumer tracks (D/E/F) build against. **Changing it reopens C3** —
> consumer tracks fill the slots, they do not edit the template ad-hoc. Need a new capability? Raise it
> against C3, don't fork the template.

## Layer rule

`ProductDetailTemplate` lives in `components/product` and imports only `components/ui`, `lib`, and
`hooks` types — never a module. Every **module-specific visual** (token icon, network selector, chart,
position card, transactions table, detail-row icons) is **injected as a slot** by the owning module's
composition (mirrors how `EarnTable` takes its `icon` slot). The template owns the page skeleton
(grid, spacing, section headings, back-link, token glow, details grid, about block); the module owns
the content.

## The contract

| Prop                  | Type                                          | Provided by | Notes                                                                                                                 |
| --------------------- | --------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `backHref`            | `string`                                      | module      | Back-link target (e.g. `ROUTES.EARN`). Rendered via `AppLink`.                                                        |
| `backLabel?`          | `ReactNode`                                   | module      | Defaults to "Back to products".                                                                                       |
| `token`               | `{ icon: ReactNode; brandColor?: string }`    | module      | `icon` is the injected `<TokenIcon/>`; `brandColor` drives the title glow + padded outline.                           |
| `title`               | `ReactNode`                                   | module      | Product name.                                                                                                         |
| `networkSelector?`    | `ReactNode`                                   | module      | Per-product network dropdown (scoped `ChainModal`), right-aligned in the header.                                      |
| `chart`               | `ReactNode`                                   | module      | Top-left Rate/TVL chart.                                                                                              |
| `position`            | `ReactNode`                                   | module      | Top-right "My position" card.                                                                                         |
| `details`             | `ProductDetailRow[]`                          | module      | `{ id, icon, label, value }[]` — template renders the 2-col grid; `value` may be a custom node (e.g. `<RiskMeter/>`). |
| `detailsTitle?`       | `ReactNode`                                   | —           | Defaults to "Details".                                                                                                |
| `about`               | `{ body: ReactNode; learnMoreHref?: string }` | module      | Template renders the heading + body + optional "Learn more".                                                          |
| `aboutTitle?`         | `ReactNode`                                   | —           | Defaults to "About".                                                                                                  |
| `transactions`        | `ReactNode`                                   | module      | The reworked transactions table.                                                                                      |
| `transactionsTitle?`  | `ReactNode`                                   | —           | Defaults to "Transactions".                                                                                           |
| `transactionsAction?` | `ReactNode`                                   | module      | Optional control at the right of the Transactions heading (e.g. a future filter).                                     |
| `faqs?`               | `ReactNode`                                   | module      | Optional corpus-fed FAQs section.                                                                                     |
| `dataTestId?`         | `string`                                      | —           | Defaults to `product-detail`.                                                                                         |

Layout: `chart | position` on the top row; `details → about → transactions → faqs` stacked in the
left column (the right column below `position` stays empty, per Figma). DOM order keeps the mobile
single-column flow correct (chart → position → details → about → transactions).

## Consuming the template (Savings is the reference)

1. **Route** — mount a full-width per-module route (not a generic `/earn/:productId`):
   ```ts
   // src/routes/_shell.earn.savings.tsx
   export const Route = createFileRoute('/_shell/earn/savings')({
     component: SavingsProductDetail,
     staticData: { intent: Intent.SAVINGS_INTENT, fullWidth: true } // fullWidth → bare container
   });
   ```
2. **Composition** — build a `<Product>ProductDetail` in the module that fills every slot from the
   module's own hooks/components. See `src/modules/savings/components/SavingsProductDetail.tsx` and its
   slot components (`SavingsDetailChart`, `SavingsPositionCard`, `SavingsTransactionsTable`).
3. **Shared building blocks already in `components/product`**: `RiskMeter` (risk row value) and
   `ProductTransactionsTable` (the transactions slot — inject action/token icons as `ReactNode`).
4. **Shared chart**: `Chart` (`modules/ui`) with `variant="detail"` gives the Rate/TVL header + pills.

## Open 🔶 items surfaced by the Savings build

These are product/design decisions the consumer tracks inherit — they do **not** change the template
contract:

- **FAQs survival** — absent from the C3 wireframe; the `faqs` slot exists but Savings renders it
  behind a disabled `SHOW_FAQS` flag pending design confirmation.
- **"6M Rate" semantics** — Savings wires a trailing 6-month average APY; confirm vs. forward estimate
  / rate-as-of-6-months-ago.
- **Risk tier (BL-07)** — Savings detail shows `low` (matches the design); the registry still hardcodes
  `moderate`. Reconcile when risk ratings get a real source.
- **Position "Already earned" / "1Y projected earnings"** — rendered but intentionally unwired (no
  cost-basis source yet).
- **Transactions "Pending" status** — confirmed history only for now; pending in-flight txs are a later
  ticket. The `ProductTransactionStatus` vocabulary already includes `pending`.
- **Inline `launch()`** — Supply/Withdraw currently open a modal hosting the existing widget; the
  inline `launch()` migration + golden-master calldata are **D3**, not C3.
