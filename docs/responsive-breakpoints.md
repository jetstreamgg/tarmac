# Responsive breakpoints & viewport units

Foundations for Track M (mobile adaptation). Applies to `apps/webapp`.

## Design-system tiers (source of truth)

From the DS Figma file, **Foundations / Grids & Spacing** (node `5176:33992`,
grid style **Mobile** added 2026-07-10):

| Tier | Device                  | Range width | Container max-width | Side padding | Columns | Gaps | Preview width |
| ---- | ----------------------- | ----------- | ------------------- | ------------ | ------- | ---- | ------------- |
| XS   | Mobile                  | 0–640       | 100%                | 12px         | 4       | 20px | 375           |
| S    | Tablet + small desktops | 640–1200    | 100%                | 24px         | 8       | 20px | 768           |
| M    | Desktop                 | 1200–1600   | 1280                | —            | 12      | 32px | 1512          |
| L    | Large Desktop           | 1600+       | 1280                | —            | 12      | 32px | 1920          |

The design breaks at **640** and **1200**. M and L share the same 1280
container, so from the webapp's perspective there are only three layout tiers.

## Tailwind tier strategy

Custom screens live in `apps/webapp/src/globals.css` (`@theme --breakpoint-*`):
`sm 640 / md 768 / lg 912 / desktop 1200 / xl 1280 / 2xl 1400`.

**New and redesigned surfaces use exactly three tiers, mobile-first:**

- **base** (no variant) — phones, the XS tier. Write default styles for a
  375px viewport.
- **`sm:`** (≥640) — the S tier: large phones landscape, tablets, small
  desktops.
- **`desktop:`** (≥1200) — the M/L tier. Existing desktop layouts live here
  and stay unchanged by mobile work.

`md` / `lg` / `xl` / `2xl` are **legacy** values kept only for the
pre-redesign screens and die with them — don't introduce new usages. `3xl`
(1680) had zero consumers and was removed in M1 (APP-367). Don't add `max-*`
variants; the codebase has none, and mobile-first `min-width` tiers keep the
cascade one-directional.

## JS breakpoints

Prefer Tailwind variants — they're SSR-safe, cheaper, and visible in the
markup. Reach for JS only when the _structure or logic_ changes with viewport
size: portalling content elsewhere (`TwoPane`), remounting on tier change
(`VaultDetailPage`), or recomputing non-CSS geometry (`Chart`).

One system, in `src/hooks/ui/useBreakpoint.ts` (import from `@/hooks`):

```ts
import { BP, useBreakpointIndex, useMediaQuery } from '@/hooks';

const { bpi } = useBreakpointIndex(); // ordinal tier, e.g. bpi < BP.md
const isShort = useMediaQuery('(max-height: 900px)'); // arbitrary queries
```

Both are `matchMedia`-based via `useSyncExternalStore`: correct on first
render, no render-time `window` reads, no per-frame resize listeners. The `BP`
ordinal mirrors the legacy Tailwind scale (`sm 0 … 2xl 5`); for new code
compare against `BP.md` (mobile cutoff) or `BP.desktop` only, matching the
three-tier strategy above.

Overlays follow the same seam. `ResponsiveModal` (M4.2) and the wallet
preview drawer (M4.6, `WalletPreviewDrawer`) branch presentation at
`bpi < BP.md` — bottom/full panel on phones, dialog or side drawer at md+ —
while their shared children reflow with plain `md:` variants, which sit on
the same 768px line. Unit tests exercise the mobile branch by mocking
`useBreakpointIndex` (happy-dom's 1024px default always lands on desktop).

## Tables on narrow viewports (M5, APP-371)

Redesigned tables never squish or overflow the page on phones. Below `BP.md`
(768 — the same JS cutoff `ResponsiveModal` uses for Dialog → bottom sheet)
they reflow; from 768 up the `<table>` renders unchanged. Per-table pattern:

| Table                                                                                     | Pattern below 768                                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Earn marketplace (`EarnTable`)                                                            | Accordion cards (Figma 486:22119): token + Rate collapsed, field grid + Supply/View details expanded. Sort headers are desktop-only.                                       |
| Product transactions (Savings/Vault/Pendle/Rewards/StUsds via `ProductTransactionsTable`) | `TransactionCard` list (Figma 486:20827): action header (+status badge), label/value field grid, "View transaction" button. A `time` column folds into the header subline. |
| Stake activity + positions                                                                | Same `TransactionCard` collapse (no stake mobile comp yet — inferred; positions keep tap-to-manage and the liquidation banner).                                            |
| Portfolio Idle (`IdleStablecoinsTable`)                                                   | `TransactionCard` with a Balance field and the Supply CTA (inferred, no comp).                                                                                             |
| Morpho vault allocations (legacy surface)                                                 | Horizontal scroll with `scrollbar-thin-always` — dense analytical grid, no comp; the redesigned vault page uses `VaultStrategy` instead.                                   |

Mechanics: `ProductTransactionsTable` accepts `renderCard` — when provided and
`bpi < BP.md`, the table swaps for a card list with the same pagination,
loading/empty/error states, `onRowClick` and `renderBelowRow`. Cards stack
flush with 2px gaps and round only the list's outer corners (20px), mirroring
the desktop table surface. Shared primitives live in
`components/product/TransactionCard.tsx`.

## Widgets & transaction flows (M7, APP-374)

Transaction forms are fluid inside every container they mount in: the mobile
bottom sheet (< 768, full width), the desktop dialog (`TransactionModal`,
490px), and the legacy widget pane (352–440px). Verified empirically at
320/360/393px across the live flows (savings supply, stake open/manage with
borrow, convert, portfolio) — no widget-owned element overflows its container.

What guarantees it, so it stays true:

- **Portalled overlays are clamped at the primitive.** Both popover recipes in
  `components/ui/popover.tsx` carry
  `max-w-[min(var(--radix-popover-content-available-width),calc(100vw_-_2rem))]`
  plus `collisionPadding` (M4.4). Consumer `w-[…]`/`w-80` idioms set an ideal
  width under that cap and are fine; **don't pass `max-w-*` overrides** — they
  replace the clamp (tailwind-merge groups them together). Pinned by
  `popover.test.tsx`.
- **Tooltips never open on touch** (`components/ui/tooltip.tsx`; the touch
  affordance is M4.3). `InfoTooltip`'s touch fallback renders through the
  clamped popover. Tooltip `max-w-*` values stay ≤ 320px.
- **In-flow widget widths are content-sized.** The widest fixed value in
  `src/widgets/` is `max-w-[160px]` (`TokenSelector` truncation cap); the rest
  are icon/skeleton dimensions. Keep it that way — new widget UI takes its
  width from the container, fixed values only as `max-w` truncation caps well
  under 280px (the sheet's content width at a 320px viewport).

Widget inventory note: the V2 modal forms live in `modules/*` and only reuse
`widgets/shared` pieces; `TradeWidget`, `L2TradeWidget` and `UpgradeWidget`
are parked pending E3 (no live consumers), `VaultWidget` and `BalancesWidget`
still render in the legacy pane (M8 routes).

## Viewport height units (`dvh` / `svh`)

On mobile browsers the URL bar and toolbars collapse as you scroll, so the
viewport height is not a constant. Conventions (already used in the shell):

- **Never `100vh`** on surfaces that render below `desktop:`. `vh` ignores
  dynamic browser chrome — on phones it overflows by the URL-bar height.
  (`--max-height-screen-70` in globals.css is 100vh-based: legacy,
  desktop-only, don't reuse.)
- **`dvh`** — for elements that own their scrolling and should track the
  _live_ viewport: dialog max-heights, internal scroll panes, the app
  container. Resizes as chrome collapses/expands.
  Examples: `AppContainer` (`h-dvh`, `md:h-[calc(100dvh-70px)]`),
  `ConnectModal` (`max-h-[calc(100dvh-32px)]`), `AppShell` pane height.
- **`svh`** — for outer-shell `min-h`/`max-h` wrappers where layout must not
  jump when chrome shows/hides: sizes to the _smallest_ viewport, so content
  is guaranteed visible even with chrome expanded.
  Example: `shellLayoutClasses` (`min-h-svh`, `max-h-svh`).
- **`lvh`** — don't use; it assumes chrome is hidden and clips content when
  it isn't.

Rule of thumb: scrolling container → `dvh`; static frame around it → `svh`.
