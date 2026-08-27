# Rewards product pages — QA cases, Figma coverage & e2e curation

Covers `/earn/rewards/$rewardContract` (per-farm reward product detail): SPK,
Grove, Chronicle Points, and the URL-only deprecated SKY farm. The bare
`/earn/rewards` index redirects to `/earn` (no overview screen — D6). Entry
from the Earn marketplace drill-down is covered in `earn/QA-CASES.md`.

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`)
page `🟠 App UI` (`386:35313`) and UX flows `🟢 Final` (`459:1600`).

**Files and pages swept:**

| File | Page / section | Result |
| ---- | -------------- | ------ |
| Sky App UI `1aCQfCwuGx90hVwGcD2ZLS` | `🟢 Earn page` (`772:56592`) | Marketplace rows reference reward farms (SPK, Chronicle, …) — drill-down entry only |
| Sky App UI | `🟢 Earn: Sky Savings` (`772:60818`) | Modal/review/confirm frames used as structural reference (see below) |
| Sky App UI | Sections for Vaults (`772:62895`), Pendle (`2653:74408`) | Not rewards — excluded |
| Sky App UI | **No `🟢 Earn: Rewards` section** | Unlike Savings/Vaults/Pendle, no dedicated hi-fi product-detail section exists |
| UX flows `YKijJiO2kdvC8rjOjKmBXg` | `🟢 Final` marketplace wireframes | "Earn SPK" / "Earn Chronicle Points" row labels in earn table context |

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

| Frame / surface (node) | Surface | Status | Notes |
| ---------------------- | ------- | ------ | ----- |
| Earn / Default view (`1036:201228`) | Marketplace row → rewards drill-down | implemented | `EarnPage.tsx` → `/earn/rewards/:contract` |
| Earn / Savings / Default (`859:35713`) | Product-detail template (structural) | **partial** | Rewards pages reuse `ProductDetailTemplate` + Savings modal pattern — no farm-specific hi-fi comps (`RewardsModalForm.tsx` documents this) |
| Supply / Review / Confirm modals (`859:35902`, `859:36152`, `859:36235`) | Supply modal flow | **partial** | Adapted from Savings template; farm-specific copy (rate, rewards-in row) ships |
| Withdraw modals (`859:35967`, `859:36319`) | Withdraw modal flow | **partial** | Same adaptation |
| Deprecated SKY farm position card | Withdraw/claim only, no supply | implemented | `rewards-position-deprecated`, `isDeprecatedRewardContract` |
| Chronicle (CLE) points farm | Points accrual, no claim CTA | implemented | `isPointsFarm` branch in `RewardsPositionCard.tsx` |
| Portfolio Merkl Rewards (`1036:189973`) | Merkl claim drawer | **deferred** | Separate claim module — not the earn rewards product page |

**Sweep verdict:** every designed entry point is accounted for. Reward product
detail pages intentionally ship without dedicated hi-fi comps, adapting the
Savings product-detail + modal template (documented in code). No `missing`
designed features beyond the absent hi-fi section itself.

---

## 2. Behavioral QA matrix

| # | Case | Verdict | Evidence |
| - | ---- | ------- | -------- |
| A-1 | SPK detail page renders chart + transactions (connected) | **pass** | `rewards.spec.ts` read smoke |
| A-2 | Disconnected: supply CTA opens connect modal | **pass** | `RewardsSupplyCard` (via shared product card pattern) |
| A-3 | Position card replaces supply CTA after first supply | **pass** | `rewards.spec.ts` supply/withdraw |
| A-4 | Bare `/earn/rewards` redirects to `/earn` | **pass** | `destinations.test.ts` |
| A-5 | Unknown contract redirects to `/earn/rewards` (orchestration) | **pass** | `useAppOrchestration.ts`, route tests |
| A-6 | Deprecated SKY farm: no supply CTA, withdraw/claim only | **pass** | `RewardsPositionCard.tsx`, unit tests |
| A-7 | Chronicle points farm: no claim button | **pass** | `RewardsPositionCard.tsx` |
| B-1 | Supply modal: invalid amount disables Review | **pass** | `rewards.spec.ts`, `RewardsModalForm.test.tsx` |
| B-2 | Max chip fills wallet balance | **pass** | `rewards.spec.ts` |
| B-3 | SPK farm USDS supply + withdraw round-trip | **pass** | `rewards.spec.ts` |
| B-4 | Claim rewards (when earned > 0) | **pass** | `useRewardsLaunch.test.tsx`; claim UI via `useClaimRewardsModal` — not duplicated in farm e2e |
| C-1 | Sequential non-batch supply (approve then supply) | **pass*** | `sequential-tx.spec.ts` — fixme pending stale-state product fix |
| C-2 | Sequential stale-state after step-2 rejection | **fail** | Known regression — fixme in `sequential-tx.spec.ts`; tracked as product fix |

---

## 3. e2e promotion table

Specs: `rewards.spec.ts`, `sequential-tx.spec.ts` (rewards section) ·
contracts `rewards-*.contract.ts` · page object `pages/RewardsProductPage.ts`.

### Promotions

| # | Spec | Contract | Covers (§2) | Why promoted |
| - | ---- | -------- | ----------- | ------------ |
| 1 | read smoke: chart + transactions | `rewards-product-default` | A-1 | Core per-farm destination |
| 2 | supply validation + max | `rewards-supply-flow` | B-1, B-2 | Client validation |
| 3 | SPK USDS supply/withdraw write | `rewards-supply-flow`, `rewards-withdraw-flow` | B-3 | On-chain write oracle |
| 4 | sequential supply (fixme) | `rewards-supply-flow` | C-1, C-2 | Retry contract canary — re-enable after product fix |

### Rejections

| Candidate | Why not e2e |
| --------- | ----------- |
| Modal review row copy per farm | `RewardsModalForm.test.tsx`, `rewardsModalRows.test.ts` |
| Claim modal multi-reward checkboxes | Claim module component tests |
| Deprecated SKY / Chronicle edge states | Hook + component tests; farm-specific setup heavy |
| About-tab banner copy per token | Static corpus content |
| Network switcher on detail page | `network-switching.spec.ts` (Shell boundary) |

### Cross-module coverage

- Earn marketplace → rewards drill-down: `earn-marketplace.spec.ts` (when row targets rewards)
- Sequential tx canary (rewards): `sequential-tx.spec.ts`

### Migration (`e2e-migration.md`)

| Spec | State | Notes |
| ---- | ----- | ----- |
| `rewards.spec.ts` | rewritten-V2 | V2 replacement for removed `reward-1/2` specs; **Gate 7: 4/4** (2026-08-27) |
| `sequential-tx.spec.ts` | rewritten-V2 | Rewards sequential section; **4 fixme** aggregate with Savings (see Savings QA §3) |

**Module complete (Gates 1–7):** §1–§2 · **4/4** e2e smokes · contracts + `RewardsProductPage` · sequential-tx fixme documented · Gate 7 green.
| `reward-1.spec.ts` | retired | Superseded by `rewards.spec.ts` (Gate 3) |
| `reward-2.spec.ts` | retired | Superseded by `rewards.spec.ts` (Gate 3) |
| `sequential-tx.spec.ts` | rewritten-V2 | Deep-link V2; rewards + savings sections; fixme cases documented |

---

## 4. Theming drift (Gate 6)

Rewards surfaces use semantic tokens via shared product components
(`ProductDetailTemplate`, `ModalAmountField`, `ProductPositionCard`). No
rewards-module magic hex drift flagged in this pass.
