# Stake module — QA cases, Figma coverage & e2e curation

Companion to [DATA-POINTS.md](./DATA-POINTS.md) (the data-point audit). This document covers the
other three verification axes: **which designed frames exist and whether they shipped** (§1),
**which behavioral cases were exercised in a real browser and with what verdict** (§2), and
**which cases were promoted into the curated e2e suite and why** (§3). Design-review findings
that need taste (spacing, color, typography judgment) live in the review report, not here —
this file records only objective coverage and verdicts.

## 1. Figma coverage map

Swept 2026-07-08 by walking both design files page-by-page (not by following previously shared
node links). Every stake-related frame in the live pages is listed; nothing else stake-shaped
exists outside them.

**Files and pages swept:**

| File                                   | Page                                        | Result                                                                                                                                              |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sky App UI (hi-fi) `1aCQfCwuGx90hVwGcD2ZLS` | `🟠 App UI` (386:35313) → section “🟢 Core Screens” (486:31150) | 13 stake frames (below). Only section on the page.                                                                                                   |
| Sky App UI (hi-fi)                     | `🟠 Mobile` (476:23)                        | Stake surfaces exist only in the `🟠TBD` section (management modal 536:32514, bundled confirm 536:32792) — **explicitly parked as TBD; no shippable mobile stake designs.** |
| Sky App UI (hi-fi)                     | Archive pages (`⚪️ UI Proposal`, `⚪️ Moodboards`, `⚪️ More explorations`, `📁 Drafts`) | Superseded explorations — excluded from coverage by page status.                                                                                     |
| UX flows `YKijJiO2kdvC8rjOjKmBXg`      | `🟢 Final` (459:1600), 3 stake sections     | 30 stake frames across “Empty state & Opening” (929:11596), “Active states & position management” (1050:19609), “Edge cases/More states” (1050:25393). |
| UX flows                               | `🟢 Transactions: Bundle/Multiple actions` (793:14566), `🟢 Transactions: Fails & recovery flow` (793:16741) | Generic (non-stake-specific) transaction UX — context for the stake bundles, not counted as stake frames.                                            |
| UX flows                               | Iteration pages (⚪️ 1–3)                    | Superseded by `🟢 Final` — excluded.                                                                                                                 |

**Status legend:** `implemented` — shipped and recognizably matching the frame (pixel deltas are
pass-2 findings, not coverage gaps) · `partial` — shipped with a designed element absent ·
`missing` — designed feature not shipped · `deferred` — knowingly not built, with the decision
reference.

### Hi-fi frames (visual truth where it exists)

| Frame (node)                                        | Surface                                | Status          | Notes                                                                                                                                                                             |
| --------------------------------------------------- | -------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SKY Staking / My positions (486:31830)              | Positions tab (table + summary + activity) | implemented     | Activity “Status” column always renders `Completed` — indexer only returns mined events, design shows a `Pending` state (§2 D-13, behavioral).                                     |
| SKY Staking / Statistics (486:31955)                | Statistics tab                         | implemented     | Chart + engine card + details strip + borrow utilization all shipped (F6/F9).                                                                                                      |
| SKY Staking / About (486:32043)                     | About tab                              | implemented     |                                                                                                                                                                                     |
| Table / Active Positions (486:32084)                | Positions table (zoom)                 | implemented     | Inactive row: design renders claimable as `0.00 <SKY icon>` (token format), not `$0.00` — checked in §2 A-12.                                                                       |
| SKY Staking / Position 1 / Management (486:32506)   | Position details modal + manage menu   | partial         | “Change reward” and “Close position” menu rows designed live, shipped disabled — **deferred, flagged on APP-312** (`PositionDetailsModal.tsx` documents the stub). Risk-meter fill treatment reviewed element-by-element in pass 2. |
| Open a position / Full overlay (486:32657)          | Open takeover                          | partial         | Borrow slider: designed dashed orange tick pattern under the track and min/max dot markers are absent — vendored shadcn `Slider` has neither (needs a tarmac-owned slider variant; follow-up candidate, not in-PR). “Updated hourly” chip and percent chips shipped. |
| Open a position / Viewport (486:32839)              | Open takeover (viewport crop)          | partial         | Same deltas as the full overlay.                                                                                                                                                    |
| Confirm / Stake & Borrow / 1–3 (486:33412/33383/33497) | Sequential tx confirm modal            | implemented     | Step list with per-step progress + active-step description + “Confirm in the wallet” chip.                                                                                          |
| Confirm / Stake & Borrow / Bundled / 1–3 (486:33469/33440/33526) | Bundled (EIP-5792) confirm modal       | implemented     | “⚡ Bundled” chip next to Actions; steps confirm as one unit — verified against the batch mock wallet in §2 F-6.                                                                     |

### UX Final frames (flow truth; liquidation surfaces have no hi-fi yet)

| Frame (node)                                          | Surface / state                          | Status      | Notes                                                                                                                                                              |
| ----------------------------------------------------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sky Staking / Empty / My Position (929:11803)         | Positions tab, no positions              | implemented | Empty copy for positions + activity shipped.                                                                                                                        |
| Sky Staking / Empty / Statistics (929:11597)          | Statistics tab, disconnected/empty       | implemented |                                                                                                                                                                     |
| Sky Staking / Empty / About (929:11721)               | About tab                                | implemented |                                                                                                                                                                     |
| Stake SKY / 01 (929:12542)                            | Open takeover, pristine                  | implemented | Wireframe of hi-fi 486:32657.                                                                                                                                       |
| Stake SKY / 02 borrow+delegate enabled (929:11863)    | Open takeover, all cards on              | partial     | Same slider-tick delta as hi-fi.                                                                                                                                    |
| Stake SKY / 02 borrow+delegate disabled (929:12265)   | Open takeover, toggles off               | implemented |                                                                                                                                                                     |
| Confirm / stake & borrow / wallet action (929:12880)  | Confirm modal + wallet panel             | implemented |                                                                                                                                                                     |
| Confirm / only stake / wallet action (929:13200)      | Confirm modal, single action             | implemented |                                                                                                                                                                     |
| SKY Staking / Active / Staked & Borrowed ×2 (929:27215, 929:27583) | Positions tab, single active position    | implemented |                                                                                                                                                                     |
| SKY Staking / Active … (Single position) (1050:19612) | Positions tab + row expanded             | implemented |                                                                                                                                                                     |
| SKY Staking / Active / Staked & Borrowed ×2 (1050:19942, 1050:20400) | Positions tab, multiple positions        | implemented | Wireframe row kebab `···` and `-` risk placeholder superseded by hi-fi chevron + unlit meter (486:32084).                                                            |
| Position details 2 (1050:20860)                       | Details modal, active urn                | partial     | Menu shows all rows live incl. “Change reward”/“Close position” → same APP-312 deferral as hi-fi 486:32506. Claim row badge (`10.90 SKY`) shipped.                   |
| Position 3 details (1050:21185)                       | Details modal, no-borrow urn             | implemented |                                                                                                                                                                     |
| Stake SKY / Manage a position / Empty (1050:21454)    | Manage sheet, no card active             | implemented | Card shell + segmented controls + toggles per frame.                                                                                                                |
| Manage a position / Active (Borrow not filled) (1050:21895) | Manage sheet, stake filled               | implemented | Before→after arrow rows shipped.                                                                                                                                    |
| Manage a position / Active (All set up) (1104:7068)   | Manage sheet, stake+borrow filled        | partial     | Manage sliders lack the designed tick pattern (same vendored-slider delta).                                                                                          |
| Manage a position / Active (1104:6429)                | Manage sheet scroll state                | implemented |                                                                                                                                                                     |
| Withdraw SKY ×2 (1050:22453, 1104:20574)              | Manage sheet, withdraw mode              | implemented | 0–100% withdraw slider ships (ticks delta as above).                                                                                                                |
| Confirm (withdraw+repay) (1104:20198)                 | Confirm modal, withdraw+repay            | implemented |                                                                                                                                                                     |
| Claim rewards (SKY) / 5, / 6 (1050:23669, 1050:23881) | Claim modal, single reward               | implemented | Network + Network fee rows and dual `Claim` / `Claim & Restake SKY` CTAs shipped.                                                                                    |
| Claim / 1 reward (1050:25642)                         | Claim modal                              | implemented |                                                                                                                                                                     |
| Claim / 2 rewards (SKY claim & Restake) (1050:25394)  | Claim modal, multi-reward checkboxes     | implemented |                                                                                                                                                                     |
| Borrow only / (Filled) (1050:24100, 1104:18395)       | Manage sheet, borrow-only mode           | implemented |                                                                                                                                                                     |
| Borrow more (USDS) / 4 (1104:18036)                   | Borrow confirm                           | implemented |                                                                                                                                                                     |
| Change delegate ×2 (1050:24534, 1104:21587)           | Manage sheet, delegate card              | implemented |                                                                                                                                                                     |
| Change delegate / 7 (1104:21216)                      | Delegate confirm (From → To)             | implemented | From→To summary verified in §2 C-8.                                                                                                                                  |
| Stake SKY (hint) (1104:19149)                         | Open takeover, reward selector w/ SOON   | **missing** | “Choose your reward token” card selector (SKY/SPK/MORPHO with per-farm APY) is not shipped — the open flow auto-defaults to the SKY farm (F4 decision A-Q2). The SPK farm is live on mainnet, so the “If more than 1 reward” condition designed against is already true. Finding AUD-19; follow-up ticket candidate. |
| Stake SKY (If more than 1 reward) (1104:19473)        | Open takeover, reward selector           | **missing** | Same as above (this is the unconditional variant).                                                                                                                   |
| Borrow (No min. collateral) / 02 (1104:19793)         | Open takeover, below dust collateral     | implemented | “More SKY needed to borrow” callout + disabled confirm shipped.                                                                                                      |
| SKY Staking / Active / Staked & Borrowed (1194:20000) | Positions tab (edge-section copy)        | implemented |                                                                                                                                                                     |
| Empty position / Staking (1194:20561)                 | Details modal, inactive urn              | implemented | Inactive chip, zeroed stats, “Reopen position” CTA, mostly-disabled menu.                                                                                            |
| Empty position / Staking & Borrowing (1194:21273)     | Details modal, inactive w/ borrow history| implemented |                                                                                                                                                                     |
| Stake SKY / Empty (1194:21595)                        | Reopen takeover                          | implemented |                                                                                                                                                                     |
| Stake SKY & Borrow USDS / Empty (1194:21914)          | Reopen takeover, borrow-expanded         | implemented |                                                                                                                                                                     |
| SKY Staking / Liquidation warning (1200:8231)         | Positions tab, at-risk banner            | implemented | Pending hi-fi (F8 gate) — reviewed vs UX only.                                                                                                                       |
| SKY Staking / Liquidated (1200:8722)                  | Positions tab, liquidated badge + banner | implemented | Pending hi-fi.                                                                                                                                                       |
| Liquidated position details single/multi (1200:7175, 1200:7374) | Post-mortem modal                        | implemented | Pending hi-fi. The `–` gaps for non-indexed bark fields are documented in DATA-POINTS.md (AUD-8/AUD-9 scope).                                                        |
| Claim rewards & withdraw SKY ×2 (1200:7749, 1200:7577) | Bundled recovery confirm                 | implemented | Pending hi-fi.                                                                                                                                                       |
| Empty state (post-recovery) (1200:7909)               | Details modal after recovery (inactive)  | implemented | Pending hi-fi. Menu enable-matrix (Change reward/delegate live on inactive urn in UX) folds into the APP-312 deferral.                                               |

**Sweep verdict:** every designed stake frame is accounted for. One designed feature is missing
(open-flow reward-token selector → AUD-19), one is deliberately deferred (details-modal
“Change reward”/“Close position” rows → APP-312), and one design-system element is systematically
simplified (slider tick pattern + min/max markers, all sliders — vendored shadcn component).
No mobile stake designs exist (explicitly TBD in the hi-fi file).

## 2. QA case matrix

_Filled during pass 1 (browser QA). Case IDs group by surface: A = positions tab, B = open/reopen
takeover, C = manage sheet, D = details/claim/post-mortem modals, E = deep links & routing,
F = tx confirm & wallet, G = themes/widths/error states._

## 3. e2e promotion table

_Filled during pass 3, after the QA matrix. Target: 6–9 specs in one stake spec file; every
contract-write path exactly one spec; promotions carry rationale, rejections a one-line reason._
