# Shell module — QA cases, Figma coverage & e2e curation

Companion to the redesign module QA goal. Covers the cross-cutting app shell:
TopNav, MobileNavbar, WalletChip + preview drawer, App Loader, first-visit terms
gate, network-switch toasts, and page-transition chrome. Product destinations
(Portfolio, Earn, …) have their own `QA-CASES.md`; this doc owns only shell
surfaces that persist across routes.

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`).
UX flows (`YKijJiO2kdvC8rjOjKmBXg`) holds wireflow context for navigation
journey diagrams; hi-fi truth for chrome lives in the UI file and the design-system
component pages referenced inline in source.

**Files and sections swept:**

| File                                | Section (node)                                                              | Result                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sky App UI `1aCQfCwuGx90hVwGcD2ZLS` | `🟢 General UX concept - User navigation` (`1030:138558`)                   | Nav/journey comps + in-context portfolio frames carrying Navbar instances |
| Sky App UI                          | `🟢 Terms & Conditions flow (1st time)` (`1868:80724`)                      | Terms modal review + confirm states                                       |
| Sky App UI                          | App Loader frame (`1875:6834`)                                              | First-visit loader                                                        |
| Sky App UI                          | Wallet preview (`1030:138710`)                                              | Desktop wallet drawer (sidebar)                                           |
| Sky App UI                          | Nav / Portfolio mobile in situ (`536:26374`)                                | Bottom navbar at 393px                                                    |
| Sky App UI                          | DS Navbar / More menu (inline refs `5010:29059`, `5069:27495`, `536:26429`) | TopNav pills + More popover/sheet                                         |

**Status legend:** `implemented` · `partial` · `missing` · `deferred`

### TopNav (desktop)

| Frame (node)                                | Surface                | Status      | Notes                                                        |
| ------------------------------------------- | ---------------------- | ----------- | ------------------------------------------------------------ |
| DS Button / Navbar Default (`5010:29059`)   | Destination pill group | implemented | `TopNav.tsx`; active via `aria-current="page"`.              |
| DS More menu panel (`5069:27495`)           | Desktop popover        | implemented | Bundling toggle, upgrade row, theme, legal, cookie settings. |
| More menu mobile sheet (`536:26429`)        | Below-md sheet         | implemented | Same content, 40px touch rows.                               |
| Navbar Item / Wallet Connect (`5069:27086`) | Disconnected chip      | implemented | `WalletChip` connect CTA.                                    |
| Navbar Item / Wallet Info                   | Connected chip         | implemented | Opens preview drawer.                                        |

### MobileNavbar (G3)

| Frame (node)                          | Surface          | Status      | Notes                                                                                |
| ------------------------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------ |
| DS Mobile / Navbar (`5153:25322`)     | Component spec   | implemented | Gradient bar, glass pill, icon+label active state.                                   |
| Nav / Portfolio in situ (`536:26374`) | 393px bottom bar | implemented | `MobileNavbar.tsx`; sliding active pill is engineering default (not design-specced). |
| `useHideOnScroll` hide-on-scroll-down | Bar visibility   | implemented | M2.1; unit-tested; e2e defers to component test.                                     |

### Wallet preview drawer

| Frame (node)                               | Surface                   | Status      | Notes                                                                               |
| ------------------------------------------ | ------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| Wallet preview (`1030:138710`)             | Desktop sidebar drawer    | implemented | No scrim overlay (by design). Assets + Activity tabs.                               |
| Mobile wallet panel (`536:26681`)          | Full-width sheet below md | partial     | Shipped; close button replaces collapse rail — verify spacing in design review.     |
| Network selector in header (`1030:138802`) | Chain dropdown in drawer  | implemented | `wallet-drawer-network`; also used from product pages via shared `NetworkSelector`. |

### App Loader

| Frame (node)              | Surface                    | Status      | Notes                                                                     |
| ------------------------- | -------------------------- | ----------- | ------------------------------------------------------------------------- |
| App Loader (`1875:6834`)  | First-visit cover + reveal | implemented | `AppLoader.tsx`; one-shot per browser; portfolio decision cache.          |
| Loader behind terms modal | Connect-time ordering      | implemented | Unit: `AppLoaderTermsFlow.test.tsx`; terms path not in default e2e build. |

### Terms & compliance (connect-time)

| Frame (node)                      | Surface                       | Status      | Notes                                                     |
| --------------------------------- | ----------------------------- | ----------- | --------------------------------------------------------- |
| Terms / To review (`1868:80725`)  | Scroll + checkbox gate        | implemented | E2e: `landing.spec.ts` with forced auth checks.           |
| Terms / To confirm (`1868:80763`) | Checkbox checked, CTA enabled | implemented | Same spec.                                                |
| Pre-tx signature step (Phase B)   | US signature before tx        | implemented | E2e: `terms-signature-gate.spec.ts` (Savings modal path). |

### Network switching (shell feedback)

| Surface                              | Status      | Notes                                                                    |
| ------------------------------------ | ----------- | ------------------------------------------------------------------------ |
| Auto-switch toast (mainnet-only nav) | implemented | E2e: `network-switching.spec.ts` matrix.                                 |
| Manual switch toast                  | implemented | `landing.spec.ts` wallet drawer; network-switching clears before matrix. |
| L2 unsupported fallback to Portfolio | implemented | Covered in network-switching spec cases.                                 |

### Retired / out of scope

| Item                                   | Disposition                                                       |
| -------------------------------------- | ----------------------------------------------------------------- |
| Legacy `widget-navigation` / hamburger | Retired B4; replaced by TopNav + MobileNavbar.                    |
| `pane-visibility.spec.ts`              | Retired B4; **G3 rewrite:** `shell-mobile.spec.ts` (this module). |
| Full pixel visual regression           | Non-goal per redesign QA plan.                                    |

---

## 2. Behavioral QA matrix

Verdicts from existing e2e + component tests unless marked **pending** (needs manual pass).

### A — TopNav & destinations

| #   | Case                                                | Verdict     | Evidence                                                |
| --- | --------------------------------------------------- | ----------- | ------------------------------------------------------- |
| A-1 | Four destinations render with correct labels        | **pass**    | `destinations.test.ts` + `TopNav.test.tsx`              |
| A-2 | Active destination highlights via `aria-current`    | **pass**    | `TopNav.test.tsx`                                       |
| A-3 | Mainnet-only Stake link carries `network=` override | **pass**    | `network-switching.spec.ts` A1                          |
| A-4 | More menu opens (popover desktop / sheet mobile)    | **pass**    | `TopNav.test.tsx`                                       |
| A-5 | Upgrade row launches upgrade modal                  | **pending** | Component stub only; no e2e (upgrade surface parked E2) |

### B — MobileNavbar (G3)

| #   | Case                                           | Verdict  | Evidence                   |
| --- | ---------------------------------------------- | -------- | -------------------------- |
| B-1 | Bottom bar visible at 393px, hidden at desktop | **pass** | `shell-mobile.spec.ts`     |
| B-2 | Tap destination navigates (all four)           | **pass** | `shell-mobile.spec.ts`     |
| B-3 | Active pill + label on current destination     | **pass** | `shell-mobile.spec.ts`     |
| B-4 | Hide on scroll down / show on scroll up        | **n/e**  | `useHideOnScroll.test.tsx` |

### C — Wallet chip & drawer

| #   | Case                                          | Verdict  | Evidence                                           |
| --- | --------------------------------------------- | -------- | -------------------------------------------------- |
| C-1 | Connect opens terms when checks forced        | **pass** | `landing.spec.ts`                                  |
| C-2 | Connected chip opens drawer                   | **pass** | `landing.spec.ts` + `WalletPreviewDrawer.test.tsx` |
| C-3 | Network switch via drawer updates URL + label | **pass** | `landing.spec.ts`                                  |
| C-4 | Assets / Activity tabs swap content           | **pass** | `WalletPreviewDrawer.test.tsx`                     |
| C-5 | Earn shortcut on asset row navigates          | **pass** | `WalletPreviewDrawer.test.tsx`                     |
| C-6 | Disconnect / switch account                   | **pass** | `WalletPreviewDrawer.test.tsx`                     |

### D — App loader

| #   | Case                                             | Verdict  | Evidence             |
| --- | ------------------------------------------------ | -------- | -------------------- |
| D-1 | Unknown visitor `/` → `/earn`                    | **pass** | `app-loader.spec.ts` |
| D-2 | First connect plays loader once, caches decision | **pass** | `app-loader.spec.ts` |
| D-3 | Returning wallet skips loader                    | **pass** | `app-loader.spec.ts` |
| D-4 | New wallet in played browser still gets cover    | **pass** | `app-loader.spec.ts` |

### E — Network switching matrix

| #   | Case                                             | Verdict  | Evidence                    |
| --- | ------------------------------------------------ | -------- | --------------------------- |
| E-1 | TopNav Stake from Base → mainnet + toast         | **pass** | `network-switching.spec.ts` |
| E-2 | Earn marketplace stays on L2; Fixed row switches | **pass** | same                        |
| E-3 | stUSDS / Savings / Convert edge cases            | **pass** | same (full matrix)          |

---

## 3. e2e promotion table

Curated shell specs live under `src/test/e2e/tests/` and use contracts in
`src/test/e2e/contracts/shell-*.contract.ts` + `pages/ShellPage.ts`.

### Promotions

| #   | Spec                           | Contract                             | Covers (§2)           | Why promoted                                             |
| --- | ------------------------------ | ------------------------------------ | --------------------- | -------------------------------------------------------- |
| 1   | `app-loader.spec.ts`           | `shell-app-loader`                   | D-1–D-4               | Public routing contract for `/` and first connect        |
| 2   | `landing.spec.ts`              | `shell-wallet-drawer`, `shell-terms` | C-1–C-3, terms frames | Connect gate + drawer network switch                     |
| 3   | `network-switching.spec.ts`    | `shell-navigation`                   | E-1–E-3, A-3          | Cross-route auto-switch matrix                           |
| 4   | `shell-mobile.spec.ts`         | `shell-mobile-nav`                   | B-1–B-3               | **G3** replacement for retired `pane-visibility.spec.ts` |
| 5   | `terms-signature-gate.spec.ts` | — (Savings module entry)             | Phase B signature     | Shell gate exercised via product modal; stays in place   |

### Rejections

| Candidate                                   | Why not e2e                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| More menu legal links / cookie row          | External URLs + consent storage; low regression value                                             |
| Theme toggle visual                         | Design-review territory; toggle mounts in `TopNav.test.tsx`                                       |
| Loader animation timing / keyframes         | Unit/component (`AppLoader.test.tsx`); not a flow oracle                                          |
| Hide-on-scroll motion                       | `useHideOnScroll.test.tsx`                                                                        |
| Wallet drawer mobile close vs collapse rail | Layout detail; component test sufficient                                                          |
| Full network matrix × mobile nav            | Duplicate of desktop matrix at different viewport — defer until mobile-specific network UX exists |

### Migration notes (`e2e-migration.md`)

| Spec                        | State        | Notes                                                                       |
| --------------------------- | ------------ | --------------------------------------------------------------------------- |
| `app-loader.spec.ts`        | rewritten-V2 | Shell Gate 7; **4/4 green** (2026-08-27)                                    |
| `landing.spec.ts`           | rewritten-V2 | Wallet drawer + terms; **4/4 green** (2026-08-27)                           |
| `network-switching.spec.ts` | rewritten-V2 | V2 TopNav testids; **11/11 green** (2026-08-27)                             |
| `shell-mobile.spec.ts`      | rewritten-V2 | G3 — replaces retired `pane-visibility.spec.ts`; **3/3 green** (2026-08-27) |

**Gate 7 (2026-08-27):** Shell specs **22/22 green** (local sequential, `workers=1`, vnet harness).

**Module complete (Gates 1–7):** Figma sweep §1 · behavioral matrix §2 · e2e §3 · contracts/page objects · component tests for rejected paths · theming §4 · all shell specs green. Deferred: wallet-drawer gradient tokenisation (§4).

## 4. Theming drift (Gate 6)

Audited 2026-08-26 against `THEMING.md` and Figma light/dark tokens. Shell chrome
uses several **intentional gradient literals** on the wallet drawer header (brand
purple ramp `#2a197d` → `#504dff`, hairline `#bcb6ef/10`) — these match Figma
`1030:138710` and are not yet tokenised. Disposition: defer token extraction to
a dedicated wallet-drawer theming pass; do not silently replace with semantic
tokens during the redesign QA sweep (dark parity).

| Surface                       | Figma                        | Code                                              | Disposition                                    |
| ----------------------------- | ---------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Wallet drawer header gradient | brand purple ramp            | `#2a197d`, `#504dff` in `WalletPreviewHeader.tsx` | Deferred — tokenise in wallet chrome follow-up |
| Nav icon gradient stops       | DS brand2                    | `#949AFF`, `#504DFF` in `TopNav.tsx` SVG          | Matches brand ramp; inline SVG defs acceptable |
| TopNav / More menu glass      | `--color-bgSecondary` + blur | `bg-bgSecondary backdrop-blur-[100px]`            | **Aligned**                                    |
| Mobile navbar glass           | glass surface tokens         | `bg-glassSurface backdrop-blur-[20px]`            | **Aligned**                                    |

No new magic hex introduced by this module's QA pass.

### Migration notes (continued)

| Spec                      | State        | Notes                                                                       |
| ------------------------- | ------------ | --------------------------------------------------------------------------- |
| `shell-mobile.spec.ts`    | rewritten-V2 | G3 — replaces retired `pane-visibility.spec.ts`; **3/3 green** (2026-08-27) |
| `pane-visibility.spec.ts` | retired (B4) | Superseded by `shell-mobile.spec.ts`                                        |
