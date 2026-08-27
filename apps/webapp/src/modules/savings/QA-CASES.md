# Savings product page — QA cases, Figma coverage & e2e curation

Covers `/earn/savings` (Sky Savings Rate product detail): hero, stats, chart,
position/supply cards, supply/withdraw modals, origin-token selection (mainnet
USDS/DAI; L2 USDS/USDC), and transactions table. Entry from Earn marketplace
drill-down is covered in `earn/QA-CASES.md`; Portfolio-position supply modals
share the same modal component (frames listed below, portfolio e2e deferred).

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`),
section `🟢 Earn: Sky Savings` (`772:60818`).

| Frame (node) | Surface | Status | Notes |
| ------------ | ------- | ------ | ----- |
| Earn / Savings / Default (`859:35713`) | No-position hero + supply card + chart + tx table | implemented | `SavingsProductDetail.tsx` |
| Earn / Savings / Earning (`859:35807`) | Active position card + stats | implemented | `SavingsPositionCard.tsx` |
| Supply more (`859:35902`) | Supply modal (form) | implemented | `SavingsModalForm.tsx` |
| Withdraw (`859:35967`) | Withdraw modal (form) | implemented | Same modal, `flow=withdraw` |
| Modal / Review Supply (`859:36152`) | Review step | implemented | `savings-modal-supply-review` |
| Review supply (`859:36258`) | Review breakdown rows | implemented | `savings-modal-row-*` |
| Confirm Supply (`859:36235`) | Confirm + wallet step | implemented | Sequential/batch confirm |
| Confirm Supply / Step 1–2 (`859:36212`, `859:36400`) | Multi-step supply (DAI upgrade bundle) | implemented | `useSavingsLaunch` bundle path |
| Confirm Supply / Step 1 (Transaction settlement) (`2644:50265`) | Settlement spinner | implemented | Shared tx status |
| Review Withdrawal (`859:36319`) | Withdraw review | implemented | `savings-modal-withdraw-review` |
| Confirm Withdrawal (`859:36377`) | Withdraw confirm | implemented | On-chain oracle in hooks tests |
| Portfolio (Active) / Positions / Supply (`859:36033`) | Same modal from Portfolio | implemented | Shared modal; portfolio e2e not duplicated |
| Portfolio (Active) / Positions / Supply Filled (`859:36086`) | Post-supply modal state | implemented | Same component |

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

No `missing` or `deferred` savings frames in the swept section.

---

## 2. Behavioral QA matrix

| # | Case | Verdict | Evidence |
| - | ---- | ------- | -------- |
| A-1 | Product page renders chart + transactions (connected) | **pass** | `mainnet-savings.spec.ts` read smoke |
| A-2 | Disconnected: supply CTA opens connect modal | **pass** | `SavingsSupplyCard.test.tsx` |
| A-3 | Position card replaces supply CTA after first supply | **pass** | `mainnet-savings.spec.ts` supply/withdraw |
| A-4 | Transactions filter (All / Supply / Withdraw) | **pass** | `SavingsTransactionsFilter.test.tsx`, `SavingsProductDetail.test.tsx` |
| B-1 | Supply modal: invalid amount disables Review | **pass** | `mainnet-savings.spec.ts`, `SavingsModalForm.test.tsx` |
| B-2 | Max chip fills wallet balance | **pass** | `mainnet-savings.spec.ts`, `SavingsModalForm.test.tsx` |
| B-3 | Mainnet USDS supply + withdraw round-trip | **pass** | `mainnet-savings.spec.ts` |
| B-4 | Mainnet DAI supply via upgrade-and-supply bundle | **pass** | `mainnet-savings.spec.ts`, `useSavingsLaunch.dai.test.tsx` |
| B-5 | USDC supply gate (geo / availability) | **pass** | `useUsdcSupplyGate.test.tsx`, `SavingsModalForm.test.tsx` |
| C-1 | L2 USDS + USDC supply and withdraw | **pass** | `l2-savings.ts` runner (four L2 specs) |
| C-2 | L2 batch wallet: approve+supply bundled | **pass** | `l2-savings.ts` batch test |
| D-1 | Parallel worker account isolation | **pass** | `mainnet-savings-parallel.spec.ts` (V2 rewrite) |
| D-2 | Network switch preserves savings route | **pass** | `network-switching.spec.ts` (Shell boundary) |

---

## 3. e2e promotion table

Specs: `mainnet-savings.spec.ts`, `l2-savings.ts` (runner), `mainnet-savings-parallel.spec.ts` ·
contracts `savings-*.contract.ts` · page object `pages/SavingsProductPage.ts`.

### Promotions

| # | Spec | Contract | Covers (§2) | Why promoted |
| - | ---- | -------- | ----------- | ------------ |
| 1 | read smoke: chart + transactions | `savings-product-default` | A-1 | Core product shell |
| 2 | supply validation + max | `savings-supply-flow` | B-1, B-2 | Client validation + modal UX |
| 3 | USDS supply/withdraw write | `savings-supply-flow`, `savings-withdraw-flow` | B-3 | On-chain write oracle |
| 4 | DAI upgrade-and-supply bundle | `savings-supply-flow` | B-4 | Multi-step confirm path |
| 5 | L2 USDS/USDC round-trip | `savings-l2-origin` | C-1 | Origin select + L2 PSM path |
| 6 | L2 batch deposit/withdraw | `savings-supply-flow` | C-2 | EIP-5792 batch wallet |
| 7 | parallel account isolation | `savings-supply-flow` | D-1 | Pool harness regression |

### Rejections

| Candidate | Why not e2e |
| --------- | ----------- |
| Inline amount error copy | `SavingsModalForm.test.tsx` |
| USDC blocked message | `useUsdcSupplyGate.test.tsx` |
| Transaction table row formatting | `SavingsTransactionsTable.test.tsx` |
| Chart tooltip / time range | Visual; hook unit tests |
| FAQ accordion copy | Static content |
| Portfolio-position supply entry | Same modal — covered by component tests; portfolio module owns drill-down e2e |

### Cross-module coverage

- Earn marketplace → savings drill-down: `earn-marketplace.spec.ts`
- Network switch on savings route: `network-switching.spec.ts`
- Sequential tx / savings confirm helper: `openSavingsSupplyConfirm.ts` → `SavingsProductPage`

### Migration (`e2e-migration.md`)

| Spec | State | Notes |
| ---- | ----- | ----- |
| `mainnet-savings.spec.ts` | rewritten-V2 | Deep-link `/earn/savings`, `savings-modal-*` testids; **Gate 7: 5/5** (2026-08-27) |
| `l2-savings.ts` (runner) | rewritten-V2 | Drives base/arbitrum/optimism/unichain savings specs |
| `mainnet-savings-parallel.spec.ts` | rewritten-V2 | V2 modal flow; parallel account-pool isolation |
| `base-savings.spec.ts` etc. | rewritten-V2 | Via `l2-savings.ts` runner; **Gate 7: 2/2 each** (4 chains) |
| `mainnet-savings-parallel.spec.ts` | rewritten-V2 | **Gate 7: 2/2** (2026-08-27) |
| `sequential-tx.spec.ts` | rewritten-V2 | Savings/rewards sequential flows; **4 fixme** (stale-state canary — component tests own rejection paths) |

**Earn product (Savings) complete (Gates 1–7):** §1–§2 · mainnet + L2 + parallel e2e · contracts + `SavingsProductPage` · sequential-tx fixme documented.

## 4. Theming drift (Gate 6)

Savings surfaces use semantic tokens via shared product components (`PageHeaderHero`,
`DetailSection`, modal form). No savings-module magic hex drift flagged in this pass.
Chart colors inherit shared chart tokens (`SavingsDetailChart.tsx`).
