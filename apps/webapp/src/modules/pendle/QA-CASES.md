# Fixed / Pendle product pages — QA cases, Figma coverage & e2e curation

Covers `/earn/fixed/:slug` (Pendle PT markets — PT-sUSDS is the live market).
Legacy `/earn/fixed/market/:address` forwards to the slug route. Matured PT
redemption lives on Portfolio (`pendle-matured-*` cards); the bare `/earn/fixed`
index redirects to `/earn` (G6).

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`),
section `🟢 Earn: Pendle sUSDS (PT-sUSDS)` (`2653:74408`).

| Frame (node) | Surface | Status | Notes |
| ------------ | ------- | ------ | ----- |
| Earn / PT-sUSDS / Default (`2653:74409`) | No-position hero + supply card + chart + maturity | implemented | `PendleProductDetail.tsx` |
| Earn / PT-sUSDS / Supplied (`2653:79858`, `2653:80294`) | Active PT position card | implemented | `PendlePositionCard.tsx` |
| Supply more (`2653:79974`) | Buy modal (form) | implemented | `PendleModalForm.tsx` |
| Review supply (`2653:80163`) / Modal / Review Supply (`2653:74768`) | Review step | implemented | `pendle-modal-supply-review` |
| Confirm Supply (`2653:80113`) | Confirm + router swap | implemented | Pendle router writes |
| Withdraw / Review Withdrawal / Confirm (`2653:80040`–`2653:80136`) | Early sell modal | implemented | Pre-maturity only |
| Slippage Change (`2653:75243`) | Slippage gear popover | implemented | `pendle-slippage-menu` |
| Portfolio … Pendle matured position (`2653:80453`) | Matured redeem on Portfolio | implemented | `PendleMaturedPositionCard.tsx` — Portfolio module |
| Portoflio / Supplied (Pendle's matured position) | Matured detail variant | implemented | Redeem CTA on detail when matured |

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

No `missing` frames in the swept section.

---

## 2. Behavioral QA matrix

| # | Case | Verdict | Evidence |
| - | ---- | ------- | -------- |
| A-1 | PT-sUSDS detail: chart + maturity + transactions (connected) | **pass** | `pendle.spec.ts` read smoke |
| A-2 | Disconnected: supply CTA opens connect modal | **pass** | `PendlePositionCard.test.tsx` |
| A-3 | Legacy `/earn/fixed/market/:address` → slug route | **pass** | `pendle.spec.ts`, route beforeLoad |
| A-4 | Unknown slug redirects to `/earn` | **pass** | `pendle.spec.ts`, `_shell.earn.fixed.$slug.tsx` |
| A-5 | Matured market: detail shows redeem layout (not buy CTA) | **pass** | `PendlePositionCard.test.tsx`, `PendleMaturedPositionCard.test.tsx` |
| A-6 | Slippage gear opens popover; custom persists per flow | **pass** | `pendleSlippagePersistence.test.tsx` |
| B-1 | Buy modal: amount validation + insufficient balance | **pass** | `PendleModalForm.test.tsx` |
| B-2 | Buy/sell write paths (router + quote API) | **n/e** | Mainnet Pendle quote API — e2e deferred (see §3) |
| B-3 | Matured redeem write on Portfolio | **pass** | `usePendleRedeemModal.test.tsx`; read path e2e in `portfolio.spec.ts` |
| B-4 | Price impact / min-received rows | **pass** | `PendleModalForm.test.tsx`, `priceImpact.test.ts` |

---

## 3. e2e promotion table

Specs: `pendle.spec.ts` · contracts `pendle-*.contract.ts` · page object `pages/PendleProductPage.ts`.

### Promotions

| # | Spec | Contract | Covers (§2) | Why promoted |
| - | ---- | -------- | ----------- | ------------ |
| 1 | read smoke: detail shell | `pendle-product-default` | A-1 | Core destination; Pendle API read-only |
| 2 | slug deep-link | `pendle-deep-link` | A-3 | Public slug route |
| 3 | legacy address redirect | `pendle-deep-link` | A-3 | Back-compat deep link |
| 4 | unknown slug → marketplace | `pendle-deep-link` | A-4 | G6 guard |
| 5 | supply modal opens | `pendle-supply-flow` | B-1 | Entry screen without quote write |
| 6 | buy/sell write | `pendle-supply-flow` | B-2 | **skipped** — Pendle quote API + router on vnet |

### Rejections

| Candidate | Why not e2e |
| --------- | ----------- |
| Slippage gear on review grid | Gear only mounts after Review; Review needs prepared quote (same vnet limit as B-2). `SlippageMenu.test.tsx`, `pendleSlippagePersistence.test.tsx`, `PendleModalForm.test.tsx` |
| Slippage persistence across reload | `pendleSlippagePersistence.test.tsx` |
| Modal validation / price impact copy | `PendleModalForm.test.tsx` |
| Matured redeem end-to-end | Read path in `portfolio.spec.ts` (`portfolio-pendle-matured`); on-chain redeem write still unit-tested |
| FAQ accordion copy | Static content |
| Earn marketplace matured row | `EarnPage.test.tsx` |

### Cross-module coverage

- Portfolio matured redeem section: `portfolio.spec.ts` (`portfolio-pendle-matured` contract)
- Legacy Expert Pendle widget: retired with D7

### Migration (`e2e-migration.md`)

| Spec | State | Notes |
| ---- | ----- | ----- |
| `pendle.spec.ts` | rewritten-V2 | **Gate 7: 5/5 active green**, 1 write fixme (Pendle quote vnet); matured read in `portfolio.spec.ts` |

**Module complete (Gates 1–7):** §1–§2 · read/deep-link e2e green · contracts + `PendleProductPage` · buy/sell writes fixme (vnet quote API) documented · Gate 7 green for promoted cases.

---

## 4. Theming drift (Gate 6)

Pendle surfaces use semantic tokens via shared product components. No pendle-module
magic hex drift flagged in this pass.
