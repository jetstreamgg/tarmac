# stUSDS product page — QA cases, Figma coverage & e2e curation

Covers `/earn/stusds` (Expert risk-capital module, D7). Legacy `/earn/expert`
and `/earn/expert/stusds` redirect here. The one-time expert-risk acknowledgement
lives in the supply modal (not a route gate).

## 1. Figma coverage map

Swept 2026-08-26 via Figma MCP against Sky App UI (`1aCQfCwuGx90hVwGcD2ZLS`)
page `🟠 App UI` (`386:35313`).

**Files and pages swept:**

| File | Page / section | Result |
| ---- | -------------- | ------ |
| Sky App UI | Dedicated `🟢 Earn: stUSDS` section | **Not found** — no standalone hi-fi section (unlike Savings/Vaults/Pendle) |
| Sky App UI | `🟢 Earn: Morpho Vaults` (`772:62895`) | stUSDS referenced as collateral in vault strategy copy only |
| UX flows | Expert / stUSDS wireframes | Superseded by V2 ProductDetailTemplate (D7) |

| Frame / surface (node) | Surface | Status | Notes |
| ---------------------- | ------- | ------ | ----- |
| Earn / USDC Vault / Default (`859:37888`) | Product-detail template (structural) | **partial** | stUSDS page reuses `ProductDetailTemplate` — no stUSDS-specific hi-fi comps |
| Supply / Review modals (`859:38102`, `859:38550`) | Supply modal pattern | **partial** | Adapted via `StUsdsModalForm` + provider notice + risk ack |
| Expert legacy overview | Retired module chrome | **deferred** | D7 collapsed Expert into `/earn/stusds` |

**Sweep verdict:** stUSDS ships without dedicated hi-fi frames; structural parity
with vault-family product pages is documented as partial with product decision D7.

---

## 2. Behavioral QA matrix

| # | Case | Verdict | Evidence |
| - | ---- | ------- | -------- |
| A-1 | Detail page renders chart + transactions (connected) | **pass** | `stusds.spec.ts` read smoke |
| A-2 | Disconnected: supply CTA opens connect modal | **pass** | `StUsdsPositionCard.test.tsx` |
| A-3 | `/earn/expert` redirects to `/earn/stusds` | **pass** | `stusds.spec.ts`, `destinations.test.ts` |
| A-4 | Provider notice in supply modal | **pass** | `stusds.spec.ts`, `StUsdsProviderNotice` |
| A-5 | Expert risk acknowledgement gates Review | **pass** | `StUsdsModalForm` tests, `useStUsdsTransactionForm.test.tsx` |
| A-6 | Price impact acknowledgement when high | **pass** | `StUsdsModalForm` tests |
| B-1 | Supply modal: invalid amount disables Review | **pass** | `stusds.spec.ts`, `useStUsdsTransactionForm.test.tsx` |
| B-2 | Provider switching between allocators | **pass** | `useStUsdsTransactionForm.test.tsx` — e2e deferred (see §3) |
| B-3 | USDS supply + withdraw round-trip | **pass** | `useStUsdsLaunch.test.tsx`; e2e write fixme |

---

## 3. e2e promotion table

Specs: `stusds.spec.ts` · contracts `stusds-*.contract.ts` · page object `pages/StUsdsProductPage.ts`.

### Promotions

| # | Spec | Contract | Covers (§2) | Why promoted |
| - | ---- | -------- | ----------- | ------------ |
| 1 | read smoke: detail shell | `stusds-product-default` | A-1 | Core destination |
| 2 | legacy `/earn/expert` redirect | `stusds-product-default` | A-3 | D7 deep-link compat |
| 3 | supply validation + provider notice | `stusds-supply-flow` | B-1, A-4 | Modal opens without write |
| 4 | supply/withdraw write | `stusds-supply-flow` | B-3 | **fixme** — Curve pool oracle on vnet |

### Rejections

| Candidate | Why not e2e |
| --------- | ----------- |
| Provider allocator switching | `useStUsdsTransactionForm.test.tsx` — was planned as `stusds-provider-switching.spec.ts` |
| Risk / impact acknowledgement copy | Component tests |
| Capacity error when module full | Hook tests with mocked capacity |
| stUSDS earnings on Portfolio | Portfolio module |

### Migration (`e2e-migration.md`)

| Spec | State | Notes |
| ---- | ----- | ----- |
| `stusds.spec.ts` | rewritten-V2 | **Gate 7: 3/3 active green**, 1 write fixme (Curve pool vnet oracle) |
| `expert-stusds.spec.ts` | retired | Superseded by `stusds.spec.ts` |
| `stusds-provider-switching.spec.ts` | retired | Superseded by component tests; no spec file existed |

**Module complete (Gates 1–7):** §1–§2 · read/validation e2e green · contracts + `StUsdsProductPage` · supply/withdraw write fixme documented · Gate 7 green for promoted cases.

---

## 4. Theming drift (Gate 6)

stUSDS surfaces use semantic tokens via shared product components. No stUSDS-module
magic hex drift flagged in this pass.
