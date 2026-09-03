# Portfolio module — QA cases, Figma coverage & e2e curation

Companion to the redesign module QA goal. Covers `/portfolio` for connected and
disconnected wallets: earnings card, Supplied/Idle tabs, positions carousel,
rewards sections, transactions, statistics, and onboarding callouts.

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`),
section `🟢 Portfolio` (`772:36720`).

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

### Disconnected & onboarding

| Frame (node)                                               | Surface                                         | Status      | Notes                                    |
| ---------------------------------------------------------- | ----------------------------------------------- | ----------- | ---------------------------------------- |
| Portfolio (Not connected) (`1036:189276`)                  | Connect prompt + marketplace cards + statistics | implemented | `UnconnectedPortfolio.tsx`               |
| Portfolio / Empty / No position / Idle (`1036:188968`)     | Simulation banner + Idle tab                    | implemented | `AllocateStablecoinsBanner` + idle table |
| Portfolio / Empty / No position / Supplied (`1036:189205`) | Supplied tab empty state                        | implemented | Positions empty + promos                 |
| Simulate earnings modal (`1036:189329`)                    | Simulation overlay                              | implemented | `SimulateEarningsModal.tsx`              |
| Portoflio / Idle / Conversion banner (`1036:189039`)       | Idle allocate CTA                               | implemented | Typo in Figma frame name only            |

### Connected — earnings & positions

| Frame (node)                                                           | Surface                 | Status      | Notes                                                                                                              |
| ---------------------------------------------------------------------- | ----------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Portfolio / Your earning positions (`1036:189460`)                     | Full connected layout   | implemented | Header, earnings card, positions, tx table                                                                         |
| Portfolio / Pie chart hover (`1036:189538`)                            | Donut hover state       | implemented | `PortfolioDonutChart.tsx`; hover is recharts-driven                                                                |
| Portfolio / Network selection (`1036:190373`)                          | Header network filter   | removed     | APP-547: no global network filter; positions carry their own chain mark                                            |
| Portfolio (Active) / Positions (`1036:189696`)                         | Supplied carousel       | implemented | `PortfolioPositionsSection`                                                                                        |
| Portfolio (Active) / Positions / Supply (`1036:189774`, `1036:189824`) | Supply modal entry      | partial     | Modal lives in product modules; portfolio triggers via `usePortfolioSupplyActions` — e2e deferred to product specs |
| Portfolio (Active) / Positions / Merkl Rewards (`1036:189973`)         | Merkl rewards block     | implemented | `PortfolioRewardsSection`                                                                                          |
| Portfolio (Active) / Positions / Ecosystem rewards (`1036:190212`)     | Ecosystem rewards block | implemented | Same section family                                                                                                |

---

## 2. Behavioral QA matrix

| #    | Case                                                           | Verdict  | Evidence                                                                              |
| ---- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| A-1  | Disconnected `/portfolio` renders connect card + statistics    | **pass** | `portfolio.spec.ts` smoke                                                             |
| A-2  | Connected `/portfolio` renders earnings card + positions shell | **pass** | `portfolio.spec.ts` smoke                                                             |
| A-3  | Supplied/Idle tabs sync across sections                        | **pass** | `ConnectedPortfolio.test.tsx`, `portfolio.spec.ts` (`.first()` on synced chip groups) |
| A-4  | Network filter scopes positions + idle table                   | **pass** | `ConnectedPortfolio.test.tsx`, `idleView.test.ts`                                     |
| A-5  | Simulate earnings banner for sub-threshold wallets             | **pass** | `ConnectedPortfolio.test.tsx`, `portfolioCallout.test.ts`                             |
| A-6  | Idle supply navigates to `/earn#earn-opportunities`            | **pass** | `IdleStablecoinsTable.test.tsx`                                                       |
| A-7  | Rewards claim rows + claim-all                                 | **pass** | `PortfolioRewardsSection.test.tsx`                                                    |
| A-8  | Transaction filters (network / stablecoin / product)           | **pass** | `PortfolioTransactionsSection.test.tsx`                                               |
| A-9  | Donut chart empty vs populated bands                           | **pass** | `PortfolioDonutChart.test.tsx`                                                        |
| A-10 | Geo-restricted products hidden from all surfaces               | **pass** | `useGeoVisibleRows.test.tsx`, `ConnectedPortfolio.test.tsx`                           |
| A-11 | Supply from position card (network auto-switch)                | **n/e**  | `usePortfolioSupplyActions.test.tsx`; product-modal e2e deferred                      |
| A-12 | Matured Pendle redeem section                                  | **pass** | `portfolio.spec.ts` (cheat-mint + UI clock + chain warp)                              |

---

## 3. e2e promotion table

Specs: `src/test/e2e/tests/portfolio.spec.ts` · contracts `portfolio-*.contract.ts` ·
page object `pages/PortfolioPage.ts`.

### Promotions

| #   | Spec                                         | Contract                   | Covers (§2) | Why promoted                                             |
| --- | -------------------------------------------- | -------------------------- | ----------- | -------------------------------------------------------- |
| 1   | smoke: disconnected portfolio shell          | `portfolio-disconnected`   | A-1         | Public route; no wallet required                         |
| 2   | smoke: connected portfolio shell             | `portfolio-connected`      | A-2, A-3    | Core destination mount + tab contract                    |
| 4   | matured PT-sUSDS in Supplied carousel        | `portfolio-pendle-matured` | A-12        | UI clock + chain warp; PT via on-chain storage-slot mint |

### Rejections

| Candidate                        | Why not e2e                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| Donut hover tooltip copy         | Visual/recharts — `PortfolioDonutChart.test.tsx`                      |
| Earnings stat partial/error gaps | Aggregator edge cases — unit tests on `EarningsStat`                  |
| Simulate modal calculator math   | Client-only — component tests                                         |
| Supply modal write path          | Product-module concern; triggers from portfolio covered in unit tests |
| Transaction table pagination     | Indexer-backed; filter wiring unit-tested                             |
| Rewards claim on-chain writes    | Claim panel e2e belongs with rewards/claim module                     |

### Migration (`e2e-migration.md`)

| Spec                | State        | Notes                                                                   |
| ------------------- | ------------ | ----------------------------------------------------------------------- |
| `portfolio.spec.ts` | rewritten-V2 | **Gate 7: 4/4** (2026-08-27); matured Pendle via cheat-mint + time warp |

**Module complete (Gates 1–7):** Figma map §1 · behavioral matrix §2 · `portfolio.spec.ts` smokes · Gate 4 contracts + `PortfolioPage` · rejected paths in component tests · theming §4 · Gate 7 green.

## 4. Theming drift (Gate 6)

Portfolio surfaces consume semantic tokens (`bg-secondary`, `text-fgPrimary`, etc.)
via shared product components. No portfolio-specific magic hex drift flagged in
this pass. Wallet drawer header literals belong to Shell module (`shell/QA-CASES.md` §4).
