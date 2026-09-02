---
name: e2e-repair
description: >-
  Diagnose and repair failed Playwright e2e specs in the tarmac webapp using
  design-linked contracts, page objects, and QA-CASES.md. Use when CI e2e
  shards fail, a Playwright locator times out, the user asks to fix a flaky or
  broken e2e test, or mentions contract context / Gate 4 / e2e-migration repair.
---

# E2E repair (design-linked)

Runtime AI selector healing is a **non-goal**. Failures stay failures; repair is deliberate and design-linked.

## Workflow

Copy and track:

```
- [ ] 1. Identity (spec, locator, contract context, artifact)
- [ ] 2. Classify break
- [ ] 3. Repair in the right layer
- [ ] 4. Prove locally (one spec, workers=1)
- [ ] 5. Close docs + PR on a feature branch
```

### 1. Identity

From the CI shard log / Playwright error, capture:

- Spec path + test title
- Failing locator (testid / role / label)
- Contract banner if present: `[contract:<id> qa:<case> figma:<frames>] …`
- Screenshot / trace from the shard artifact

Key paths:

- Contracts: `apps/webapp/src/test/e2e/contracts/`
- Page objects: `apps/webapp/src/test/e2e/pages/`
- Specs: `apps/webapp/src/test/e2e/tests/`
- Migration table: `apps/webapp/src/test/e2e/e2e-migration.md`
- Module matrices: `apps/webapp/src/modules/<module>/QA-CASES.md` (Shell: `modules/app/shell/`)

### 2. Classify

| Kind | Signal | Action |
| ---- | ------ | ------ |
| Harness flake | toast overlay, account pool, expired vnet, geo/Network modal | Fix harness helper / env; do **not** weaken product assertions |
| Locator drift | renamed/moved testid or role | Update **page object** only |
| Flow / IA change | step gone, new screen, deep-link changed | Update contract + page object + `QA-CASES.md` §1/§2 |
| Product bug | UI wrong vs Figma / oracle | File bug; keep red (or `test.fixme` + ticket only if intentional deferral) |
| Known deferral | Pendle quote, subgraph-blind, E3 CoW | Confirm disposition in QA-CASES §3; do not invent coverage |

Harness reminders:

- MKR→SKY toast: `suppressGovernanceMigrationToast` (via `connectMockWalletAndAcceptTerms`)
- Auth/geo modal: `VITE_SKIP_AUTH_CHECK=true` in Playwright webServer env
- Tx success oracle: `transaction-status-badge` → `Success` (not legacy copy)
- Expired forks: `pnpm vnet:fork` from repo root; clear `apps/webapp/tmp/test-account-pool.json` + `persistent-vnet-snapshots.json` when RPC URLs / account count change

### 3. Repair

1. Open the **contract** (`contracts/<id>.contract.ts`) — intent, steps, Figma frames, oracle.
2. Open **Figma** at those frame IDs (refresh node IDs in QA-CASES §1 if the file reorganized).
3. Confirm design still expects the control.
4. Fix the **page object** (`pages/*Page.ts`). Specs must not grow one-off selectors.
5. Locator priority: `data-testid` → role/name → label. Prefer testids.
6. If the step was rejected from e2e, put coverage in a **component/unit** test and document under QA-CASES §3 Rejections.

Do **not**:

- Greenwash with a weaker assertion
- Scatter selectors in the spec
- Invent mobile layouts Figma marks TBD
- Runtime-heal / retry with alternate CSS

### 4. Prove locally

One spec at a time (never dump the full suite first):

```bash
cd apps/webapp
CI=true pnpm exec playwright test --config playwright-parallel.config.ts --workers=1 \
  src/test/e2e/tests/<spec>.spec.ts
```

`ACCOUNT_COUNT` only needs to cover that spec’s permanent account claims. If `ERR_CONNECTION_REFUSED`, kill the stale server on port 3000 and re-run with `CI=true`.

### 5. Close the loop

- Update `QA-CASES.md` if status/disposition changed
- Update `e2e-migration.md` only if the spec’s migration state changed
- Ship on a **feature branch** + PR into `app-redesign` (never commit straight to the integration branch unless the user explicitly asks)
- No `Co-authored-by: Cursor` / AI attribution in commits

## Quick map: fail → owner

| Symptom | First file to open |
| ------- | ------------------ |
| `[contract:…]` in error | Matching `contracts/*.contract.ts` then page object |
| Toast blocks click | `utils/suppressGovernanceMigrationToast.ts` / connect helper |
| L2 balance 0 / wrong chain | `utils/switchWalletNetwork.ts` + page `gotoConnected` |
| Success copy missing | Page object confirm helper → status badge |
| Spec still `blocked-on-nav-rewrite` | Rewrite per Gate 3; update `e2e-migration.md` |
