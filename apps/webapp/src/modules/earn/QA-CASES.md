# Earn marketplace — QA cases, Figma coverage & e2e curation

Covers `/earn` (the marketplace index): hero, featured cards, opportunities
table, filters, geo-restricted / requires-action sections, and deep-link
contracts (`?token=`, `#earn-opportunities`). Product detail pages (`/earn/savings`,
`/earn/vaults/...`, etc.) belong to the Earn product-pages pass (goal item 4).

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`),
section `🟢 Earn page` (`772:56592`).

| Frame (node)                                            | Surface                                     | Status      | Notes                                            |
| ------------------------------------------------------- | ------------------------------------------- | ----------- | ------------------------------------------------ |
| Earn / Default view (`1036:201228`)                     | Hero + featured cards + opportunities table | implemented | `EarnPage.tsx`                                   |
| Earn / Default view / "Low" risk hover (`1036:201512`)  | Risk filter hover + tooltip                 | implemented | `EarnTableFilters` + `RiskTierDetails`           |
| Risk profile tooltip (`1036:201215`)                    | Risk tier explainer                         | implemented | Shared product component                         |
| Earn / Filtering (Network + stablecoin) (`1036:201582`) | URL + dropdown filters                      | implemented | `useEarnTableState`, `EarnTableFilters`          |
| Earn (Only one highlighted) (`1036:201301`)             | Featured card emphasis                      | implemented | `EarnFeaturedCards.tsx`                          |
| Earn (US regulations) (`1036:201400`)                   | Geo-restricted + unavailable sections       | implemented | `earn-unavailable`, `partitionByGeoAvailability` |

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

No `missing` or `deferred` marketplace frames in the swept section.

---

## 2. Behavioral QA matrix

| #    | Case                                                   | Verdict  | Evidence                                                             |
| ---- | ------------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| A-1  | Default marketplace mounts hero, featured cards, table | **pass** | `earn-marketplace.spec.ts` smoke                                     |
| A-2  | `?token=` URL filter narrows visible rows              | **pass** | `EarnPage.test.tsx`, `earn-marketplace.spec.ts`                      |
| A-3  | Risk filter persisted in localStorage                  | **pass** | `EarnPage.test.tsx`, `useEarnTableState.test.tsx`                    |
| A-4  | Clear-filters control counts hidden rows               | **pass** | `EarnPage.test.tsx`                                                  |
| A-5  | `#earn-opportunities` deep link scrolls to heading     | **pass** | `EarnPage.test.tsx`                                                  |
| A-6  | Filter edit drops hash (no re-scroll)                  | **pass** | `EarnPage.test.tsx`                                                  |
| A-7  | Row click navigates to product detail                  | **pass** | `network-switching.spec.ts`, `earn-marketplace.spec.ts`              |
| A-8  | Geo-restricted rows in unavailable section             | **pass** | `geoAvailability.test.ts`, `EarnPage.test.tsx`                       |
| A-9  | Matured Pendle "Requires action" section               | **pass** | `EarnPage.test.tsx` (mocked matured positions)                       |
| A-10 | Earn marketplace never auto-switches network on nav    | **pass** | `network-switching.spec.ts` A2 control                               |
| A-11 | Mobile marketplace layout                              | **n/e**  | No shippable mobile-specific earn comp beyond responsive breakpoints |

---

## 3. e2e promotion table

Specs: `src/test/e2e/tests/earn-marketplace.spec.ts` · contracts `earn-*.contract.ts` ·
page object `pages/EarnMarketplacePage.ts`.

### Promotions

| #   | Spec                                   | Contract                     | Covers (§2) | Why promoted                                    |
| --- | -------------------------------------- | ---------------------------- | ----------- | ----------------------------------------------- |
| 1   | smoke: marketplace shell               | `earn-marketplace-default`   | A-1         | Core destination; catches route/build breakage  |
| 2   | smoke: token URL filter                | `earn-marketplace-filter`    | A-2, A-4    | Public deep-link API from Portfolio idle supply |
| 3   | smoke: row navigates to savings detail | `earn-marketplace-drilldown` | A-7         | Drill-down IA contract                          |

### Rejections

| Candidate                             | Why not e2e                                     |
| ------------------------------------- | ----------------------------------------------- |
| Risk hover tooltip copy               | Design-review + `EarnTable.test.tsx`            |
| Featured card wide layout             | Visual; `EarnFeaturedCards.test.tsx`            |
| Geo unavailable reason strings        | Geo mock heavy; unit tests on `geoAvailability` |
| Requires-action matured Pendle writes | Pendle module e2e (skipped scaffold)            |
| Sort column toggles                   | `EarnTable.test.tsx`                            |
| Hash scroll pixel position            | `EarnPage.test.tsx` scrollIntoView spy          |

### Cross-module coverage

Network-switch matrix cases that touch Earn rows remain in
`network-switching.spec.ts` (Shell/Earn boundary) — not duplicated here.

### Migration (`e2e-migration.md`)

| Spec                       | State        | Notes                                                              |
| -------------------------- | ------------ | ------------------------------------------------------------------ |
| `earn-marketplace.spec.ts` | rewritten-V2 | First dedicated Earn marketplace e2e; **Gate 7: 3/3** (2026-08-27) |

**Module complete (Gates 1–7):** Marketplace IA §1–§2 · drill-down + filter e2e · contracts + `EarnMarketplacePage` · product writes delegated to sub-module specs · Gate 7 green.

---

## 4. Theming drift (Gate 6)

Earn marketplace uses semantic tokens via shared product components (`EarnTable`,
`PageHeaderHero`, filter chips). No earn-module magic hex drift flagged in this pass.
