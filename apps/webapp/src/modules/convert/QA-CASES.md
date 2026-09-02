# Convert module — QA cases, Figma coverage & e2e curation

Companion to the redesign module QA goal. Covers `/convert` PSM stablecoin conversion
(USDS ↔ USDC). Trade (`/convert/trade`) and Upgrade (`/convert/upgrade`) surfaces were
removed in E2 and redirect to `/convert` — tracked as deferred/retired below.

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`),
section `🟢Convert` (`1030:137865`).

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

| Frame (node)                                                   | Surface                          | Status      | Notes                                                                                           |
| -------------------------------------------------------------- | -------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| Convert / Default (`1036:205437`)                              | Connected swap card, USDS→USDC   | implemented | `ConvertPage.tsx`, `ConvertCard.tsx`                                                            |
| Convert / Asset selection (`1036:205471`)                      | Token dropdown + percent chips   | partial     | Percent chips + token select shipped; Figma tooltip on asset row not replicated (design polish) |
| Review conversion (`1036:205506`, modal `1036:205509`)         | Review modal breakdown           | implemented | `ConvertReviewContent.tsx`, `convert-modal-*` testids                                           |
| Confirm conversion (`1036:205561`)                             | Confirm step list + wallet panel | implemented | Shared `TransactionModal`; step labels verified in e2e                                          |
| Convert / Default + Toast (`1036:205588`, toast `1036:205622`) | Post-tx success toast            | implemented | Success copy on modal Done path; toast variant matches DS                                       |

### Deferred / out of scope (E2)

| Surface                      | Status       | Notes                                                                                                                     |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| CoW Trade (`/convert/trade`) | **deferred** | Route redirects to `/convert`; E3 CoW migration — legacy `l2-trade.ts` / `cowswap-trade.ts` specs **retired**             |
| Upgrade (`/convert/upgrade`) | **deferred** | E2 product decision: route redirects to `/convert` PSM-only; `upgrade.spec.ts` **retired** until MKR→SKY surface restored |

**Sweep verdict:** every frame in the live `🟢Convert` section is accounted for. Trade and Upgrade
are explicitly out of the current V2 Convert module scope.

---

## 2. Behavioral QA matrix

| #    | Case                                                | Verdict  | Evidence                                             |
| ---- | --------------------------------------------------- | -------- | ---------------------------------------------------- |
| A-1  | `/convert` renders heading, card, network selector  | **pass** | `psm-conversion.ts` Navigation & UI                  |
| A-2  | Review disabled with empty amount                   | **pass** | same                                                 |
| A-3  | Default direction USDS→USDC; to field read-only     | **pass** | same                                                 |
| A-4  | Connected wallet shows numeric balances             | **pass** | same                                                 |
| A-5  | Amount entry enables Review; 1:1 mirror on to field | **pass** | Amount entry describe                                |
| A-6  | Percent chips (25/50/100) set positive amounts      | **pass** | same                                                 |
| A-7  | Insufficient funds disables Review                  | **pass** | `ConvertPage.test.tsx`, `useConvertForm.test.tsx`    |
| A-8  | Flip toggles direction; preserves amount            | **pass** | `psm-conversion.ts` Direction switching              |
| A-9  | Review modal shows from/to amounts and fee rows     | **pass** | Review modal describe                                |
| A-10 | Close modal returns to editable form                | **pass** | same                                                 |
| A-11 | USDS→USDC bundled write completes                   | **pass** | Bundled transaction describe                         |
| A-12 | USDC→USDS bundled write completes                   | **pass** | same                                                 |
| A-13 | Step list shows Approve + Convert labels            | **pass** | same                                                 |
| A-14 | Sequential (non-batch) flow completes               | **pass** | Sequential describe                                  |
| A-15 | Rejected tx → error + Back/Retry                    | **pass** | Error handling describe; `usePsmConversion.test.tsx` |
| A-16 | Legacy `/convert/psm` redirects to `/convert`       | **pass** | URL state (mainnet)                                  |
| A-17 | `?source_token=USDC` sets USDC→USDS                 | **pass** | same                                                 |
| A-18 | Round-trip USDS→USDC→USDS                           | **pass** | Round-trip describe                                  |
| B-1  | L2 PSM3 swap on Base/Arb/OP/Unichain                | **pass** | Network-specific `*-psm.spec.ts` runners             |
| T-1  | CoW trade USDC↔USDS                                 | **n/e**  | Surface unreachable — E3 CoW                         |
| U-1  | MKR→SKY upgrade card                                | **n/e**  | Surface unreachable — product decision               |

---

## 3. e2e promotion table

Specs: `psm-conversion.ts` (runner) · per-network `*-psm.spec.ts` · contracts
`convert-psm-*.contract.ts` · page object `pages/ConvertPage.ts`.

### Promotions

| #   | Spec                        | Contract                                   | Covers (§2)    | Why promoted                        |
| --- | --------------------------- | ------------------------------------------ | -------------- | ----------------------------------- |
| 1   | Navigation & UI             | `convert-psm-default`                      | A-1–A-4        | Core `/convert` mount + form shell  |
| 2   | Amount / flip / review      | `convert-psm-default`, `convert-deep-link` | A-5–A-10, A-8  | Client validation + modal read path |
| 3   | Bundled + sequential writes | `convert-psm-flow`                         | A-11–A-14, B-1 | On-chain PSM write oracle           |
| 4   | Error + URL state           | `convert-psm-flow`, `convert-deep-link`    | A-15–A-17      | RPC reject + deep-link contracts    |
| 5   | Round-trip                  | `convert-psm-flow`                         | A-18           | Multi-tx integration                |

### Rejections

| Candidate                          | Why not e2e                               |
| ---------------------------------- | ----------------------------------------- |
| Token dropdown search/filter UX    | Component — `ConvertTokenSelect` if added |
| Geo-blocked convert banner         | `ConvertPage.test.tsx` (APP-444)          |
| Modal row rate string formatting   | `convertModalRows.test.ts`                |
| Trade slippage / CoW quote paths   | Surface retired until E3                  |
| Upgrade allowance + migrate writes | Surface retired pending product decision  |

### Migration (`e2e-migration.md`)

| Spec                                                 | State        | Notes                                                  |
| ---------------------------------------------------- | ------------ | ------------------------------------------------------ |
| `psm-conversion.ts` (runner)                         | rewritten-V2 | V2 `/convert` page; `convert-*` testids; `ConvertPage` |
| `mainnet-psm.spec.ts`                                | rewritten-V2 | Via runner; **Gate 7: 23/23** (2026-08-27)             |
| `base-psm.spec.ts`                                   | rewritten-V2 | Via runner; **Gate 7: 21/21**                          |
| `arbitrum-psm.spec.ts`                               | rewritten-V2 | Via runner; **Gate 7: 21/21**                          |
| `optimism-psm.spec.ts`                               | rewritten-V2 | Via runner; **Gate 7: 21/21**                          |
| `unichain-psm.spec.ts`                               | rewritten-V2 | Via runner; **Gate 7: 21/21**                          |
| `l2-trade.ts`, `*-trade.spec.ts`, `cowswap-trade.ts` | retired      | E3 CoW — `/convert/trade` unreachable                  |
| `upgrade.spec.ts`                                    | retired      | E2 PSM-only product decision                           |

**Module complete (Gates 1–7):** PSM surface fully mapped §1–§2 · **107/107** PSM e2e (5 networks) · `ConvertPage` + contracts · trade/upgrade **retired** with product decision · Gate 7 green for PSM. Trade/upgrade deferred to E3 CoW / product.

**Local harness (Gate 7):** `playwright-parallel.config.ts` sets `VITE_SKIP_AUTH_CHECK=true` (matches CI). Snapshot must fund ≥23 accounts and all five networks for L2 runners; delete `persistent-vnet-snapshots.json` after changing `ACCOUNT_COUNT` or `FUND_NETWORKS`.

## 4. Theming drift (Gate 6)

Convert surfaces use semantic tokens via shared DS components (`Button`, `TransactionModal`).
`ConvertReviewContent` references Figma modal node `1036:205509` in code comments; no
convert-specific magic hex drift flagged in this pass.
