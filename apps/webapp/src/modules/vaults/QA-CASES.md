# Vaults product pages — QA cases, Figma coverage & e2e curation

Covers `/earn/vaults/$provider/$vaultAddress`: Morpho vaults (USDC/USDS/USDT
Risk Capital, Flagship, USDT Savings) on the V2 `ProductDetailTemplate`, and
Spark Tether Savings (sUSDT) on the legacy widget stack pending APP-266. The
bare `/earn/vaults` index redirects to `/earn` (D6 — no overview screen).

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`),
section `🟢 Earn: Morpho Vaults (USDC/USDS/USDT)` (`772:62895`).

| Frame (node) | Surface | Status | Notes |
| ------------ | ------- | ------ | ----- |
| Earn / USDC Vault / Default (`859:37888`) | No-position hero + supply card + chart + strategy | implemented | `VaultProductDetail.tsx` (all Morpho vaults) |
| Earn / USDC Vault / Earning (`859:37980`) | Active position card + claim | implemented | `VaultPositionCard.tsx` |
| Supply More (`859:38102`) | Supply modal (form) | implemented | `VaultModalForm.tsx` |
| Review supply (`859:38170`) / Modal / Review Supply (`859:38550`) | Review step | implemented | `vault-modal-supply-review` |
| Confirm Supply (`859:38611`) | Confirm + wallet | implemented | `useVaultLaunch` |
| Withdraw (`859:38294`) / Review Withdrawal (`859:38231`) | Withdraw modal | implemented | `vault-modal-withdraw-*` |
| Confirm Withdrawal (`859:38634`) | Withdraw confirm | implemented | On-chain oracle in hooks tests |
| Claim / 1–2 rewards / review+confirm (`859:38362`–`859:38686`) | Merkl claim from position card | implemented | Claim module; not duplicated in vault e2e |
| Different strategy composition (`2401:67256`) | Strategy breakdown variants | implemented | `VaultStrategy.tsx` |
| Strategy hover (`2401:67818`) | Strategy tooltip | **partial** | Visual hover — component tests |
| Spark Tether Savings (sUSDT) product detail | Full-width V2 page | **deferred** | APP-266 — ships legacy widget + `VaultDetails` at `/earn/vaults/sky/:address` |
| Earn page marketplace rows | Vault drill-down entry | implemented | `earn/QA-CASES.md` |

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

**Sweep verdict:** every Morpho vault frame in the dedicated section is
accounted for. Spark sUSDT intentionally remains on the legacy widget until
APP-266 lands a V2 product page.

---

## 2. Behavioral QA matrix

| # | Case | Verdict | Evidence |
| - | ---- | ------- | -------- |
| A-1 | USDC Risk Capital detail: chart + strategy + transactions | **pass** | `vaults-morpho.spec.ts` read smoke |
| A-2 | Disconnected: supply CTA opens connect modal | **pass** | `VaultSupplyCard.test.tsx` |
| A-3 | Position card after first supply | **pass** | `vaults-morpho.spec.ts` |
| A-4 | Bare `/earn/vaults` redirects to `/earn` | **pass** | `destinations.test.ts` |
| A-5 | Unknown vault redirects to `/earn` | **pass** | `VaultDetailPage.tsx`, orchestration |
| A-6 | Spark sUSDT legacy widget renders (flag-gated) | **pass** | `vaults-spark.spec.ts` (legacy UI) |
| A-7 | Morpho vault claim CTA when Merkl rewards accrued | **pass** | `vaultPositionCard.rewards.test.tsx` |
| B-1 | Supply modal: invalid amount disables Review | **pass** | `vaults-morpho.spec.ts`, `useVaultTransactionForm.test.tsx` |
| B-2 | Max chip fills wallet balance | **pass** | `vaults-morpho.spec.ts` |
| B-3 | Morpho USDC vault supply + withdraw round-trip | **pass** | `vaults-morpho.spec.ts` |
| B-4 | Liquidity-constrained supply notice | **pass** | `VaultModalForm` + `useVaultTransactionForm.test.tsx` |
| C-1 | Spark sUSDT supply/withdraw via legacy widget | **pass** | `vaults-spark.spec.ts` (legacy testids) |

---

## 3. e2e promotion table

Specs: `vaults-morpho.spec.ts`, `vaults-spark.spec.ts` · contracts `vault-*.contract.ts` ·
page object `pages/VaultProductPage.ts`.

### Promotions

| # | Spec | Contract | Covers (§2) | Why promoted |
| - | ---- | -------- | ----------- | ------------ |
| 1 | Morpho read smoke | `vault-product-default` | A-1 | V2 product shell |
| 2 | Morpho supply validation + max | `vault-supply-flow` | B-1, B-2 | Client validation |
| 3 | Morpho USDC supply/withdraw write | `vault-supply-flow`, `vault-withdraw-flow` | B-3 | On-chain write oracle |
| 4 | Spark sUSDT legacy widget writes | — (legacy testids) | C-1 | APP-266 deferred V2; deep-link nav fixed |

### Rejections

| Candidate | Why not e2e |
| --------- | ----------- |
| Strategy hover tooltip | Visual; `VaultStrategy` tests |
| Rate breakdown popover | `VaultRateBreakdown` component tests |
| Merkl claim multi-reward modal | Claim module tests |
| All five Morpho vault variants | One vault proves modal + ERC-4626 path; registry covered in unit tests |
| Vault overview / "My vaults" list | Retired with G6; marketplace is entry |

### Cross-module coverage

- Earn marketplace drill-down: `earn-marketplace.spec.ts`
- Legacy Expert Morpho widget: `expert-morpho.spec.ts` **retired** — superseded by `vaults-morpho.spec.ts` (Expert module removed D7)

### Migration (`e2e-migration.md`)

| Spec | State | Notes |
| ---- | ----- | ----- |
| `vaults-morpho.spec.ts` | rewritten-V2 | Deep-link `/earn/vaults/morpho/:address`, `vault-modal-*`; **Gate 7: 4/4** (2026-08-27) |
| `vaults-spark.spec.ts` | legacy-passing | Deep-link `/earn/vaults/sky/:address`; legacy widget testids until APP-266 |

**Module complete (Gates 1–7):** §1–§2 · Morpho **4/4** e2e · contracts + `VaultProductPage` · Spark vault excluded from green track (APP-266) · Gate 7 green for Morpho.

---

## 4. Theming drift (Gate 6)

Vault surfaces use semantic tokens via shared product components. No vault-module
magic hex drift flagged in this pass.
