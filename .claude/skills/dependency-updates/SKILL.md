---
name: dependency-updates
description: Manually run dependabot-style dependency updates (dependabot doesn't handle pnpm catalogs well). Use when asked to update dependencies, run dependabot manually, or do the monthly dependency bump. Applies the rules from .github/dependabot.yml as catalog edits in pnpm-workspace.yaml, one commit per group, then runs all gates and opens a PR.
---

# Manual dependency updates

Dependabot PRs are unreliable with pnpm catalogs, so version updates are done manually with this procedure. All dependency versions live in the `catalog:` section of `pnpm-workspace.yaml`: every bump is an edit there plus a `pnpm install` to refresh the lockfile.

The two scripts in `scripts/` do the mechanical parts. Run them from the repo root:

- `plan-updates.mjs` finds every catalog entry that can move and its target version, sorted by group.
- `bump-catalog.mjs` edits catalog versions and keeps each entry's `^`, `~` or exact style.

## 0. Preflight

- **Node**: use the version in `.nvmrc` (24). If `node -v` reports something older, put that Node first on `PATH` for every command in the run. pnpm only warns about the `engines` mismatch, but it adds non-JSON noise to its output, and the planning script refuses to run on an older Node.
- **`.env`** with `TENDERLY_API_KEY` must exist at the repo root; `pnpm test` needs it. A fresh worktree may not have one.

## 1. Load the rules (do not hardcode them)

`plan-updates.mjs` reads both files on every run. Read them yourself too, since the config changes over time and the comments explain the exceptions:

- `.github/dependabot.yml`: allowed update types, per-dependency ignores (`update-types` and `versions`), and the group definitions (used for commit granularity). Expect the wallet-connector packages to be patch-only.
- `pnpm-workspace.yaml`: the catalog and `minimumReleaseAge` (minutes; 10080 = 7 days).

## 2. Branch

Work on `chore/dependency-updates-<YYYY-MM>`, based on a freshly fetched `origin/development`. If you're already on a new branch with no commits beyond `development`, for example one created by your worktree tool, rename it with `git branch -m` rather than leaving it behind.

## 3. Plan the updates

```bash
node .claude/skills/dependency-updates/scripts/plan-updates.mjs --json <scratch>/plan.json
```

For each catalog entry, the script picks the newest stable version that:

- the dependabot ignore rules allow, and
- was published before now − `minimumReleaseAge`. Writing a too-new lower bound into the catalog makes `pnpm install` fail.

It assigns each bump to the first dependabot group that matches, as dependabot does, and prints a ready-to-run `bump-catalog.mjs` command per group. Two more sections:

- **Floor-only**: the lockfile already resolves the target. These aren't updates, so they're left out of the apply commands.
- **Held back**: why the latest version wasn't taken (a major, patch-only, too young, or excluded by a `versions` rule).

The script doesn't know about the couplings and holds in **Known pins & recurring checks** below. Go through that list and adjust the plan by hand. Also look at any row flagged `0.x minor`: semver treats those as breaking.

Present the resulting list to the user grouped like the dependabot groups, with the held-back majors listed separately, **before applying anything**.

## 4. Review release notes (in parallel with step 5)

The gates don't catch runtime behavior changes. In 2026-08, viem's `parseUnits('')` started throwing and broke every widget input, with all gates green. Review every bump's release notes for:

- behavior changes
- deprecations
- fixes to APIs the app calls

If your harness supports subagents, start one read-only agent per group (in Claude Code: `Explore`, in the background). They only read, so they can run while you apply the commits. Give each agent its group's `pkg from → to` list and ask it to:

- read the changelog or GitHub releases for every version in each range, and
- search `apps/webapp/src` for the affected APIs.

Ask for a short risk list (package, change, affected call sites, how to check it), not a changelog summary. Without subagents, do the same review sequentially, starting with web3-tools and infrastructure.

Put the findings in the PR body. A finding that needs a code change gets its own commit. Otherwise, hold that package back and explain why in the PR.

## 5. Apply as grouped commits

One commit per dependabot group (bisectability). For each group:

1. Run the `bump-catalog.mjs` command from the plan.
2. Run `pnpm install`.
3. Commit with a message naming the notable bumps.

If a gate later needs a fix that belongs to one group, fold it into that group's commit so every commit still builds. A coupled transitive bump is an example (see Known pins). Use `git commit --fixup=<sha>` followed by `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash origin/development`.

## 6. Formatting fallout

If **tailwindcss** or **prettier** was bumped, run `pnpm prettier:check`. A tailwindcss bump alone typically reformats dozens of files: `prettier-plugin-tailwindcss` sorts classes by the canonical order of the _installed_ Tailwind version.

Format only the flagged files:

```bash
pnpm exec prettier --list-different . | xargs pnpm exec prettier --write
```

Avoid `pnpm prettier`: it rewrites everything under `.`, including any nested checkouts. Put the result in its **own commit** (don't fold it into a group). Attribute the changes correctly in the commit and the PR: Tailwind class re-sorting vs. actual prettier restyling.

## 7. Gates

1. Run `pnpm build` first and on its own. It starts with `pnpm messages`, which rewrites the compiled catalogs in `apps/webapp/src/locales` that the other gates read.
2. Then start `pnpm test` in the background. It runs the unit suite plus the vnet hooks suite, takes about 3–5 minutes, and needs `TENDERLY_API_KEY`. Never run two vnet-backed test runs at once.
3. While it runs, run these in parallel:
   - `pnpm typecheck`
   - `pnpm lint`. It runs with `--max-warnings 0`, so passing already proves the warning count didn't grow.
   - `pnpm prettier:check`
   - `pnpm audit --prod --audit-level high`

Vitest can exit non-zero while every test passes. Check the summary's `Errors` line for unhandled rejections before concluding the suite is green.

After the test run, **restore `tenderlyTestnetData.json`** with `git checkout -- tenderlyTestnetData.json`. The vnet lifecycle rewrites it with ephemeral testnet IDs that teardown has already deleted. Never commit that churn.

## 8. PR and CI

Push and open a single PR to `development`. The body should list:

- each group's bumps
- the held-back packages (with reasons where non-obvious)
- the release-note risks from step 4
- the formatting-commit attribution, if any
- the verification checklist

Then watch CI (`gh pr checks <number> --watch`). If e2e shards fail, use the `e2e-repair` skill. Before blaming the bumps, check whether the same job is also red on `development`'s latest run.

When web3-tools moved by more than a patch, smoke-test a transaction flow on a Tenderly fork (`pnpm vnet:fork`, then `pnpm -F webapp dev:mock` with the mock wallet). This is optional for smaller bumps.

## Known pins & recurring checks

- **@metamask/connect-evm follows `@wagmi/connectors`' peer range, not the patch-only rule.**
  - It is never imported directly; it only satisfies the peer dependency of wagmi's `metaMask()` connector.
  - That peer is `^2.1.0` (it moved off 1.x in 2026-08), so the catalog is on 2.x and uses `^`.
  - Each run, check the peer range of the `@wagmi/connectors` version that the target wagmi depends on: `npm view @wagmi/connectors@<ver> peerDependencies`.
  - If the range moves to a new major, follow it as a deliberate deviation from the patch-only rule and document it in the PR.
- **The other wallet-connector packages** are deliberately conservative: patch-only with `~` ranges. Do not "helpfully" widen them.
- **`@lingui/swc-plugin` is coupled to the transitive `@swc/core`.**
  - The plugin's wasm is built against one specific `swc_core`. Its README has a compatibility table.
  - A mismatch makes `pnpm build` fail with `failed to run Wasm plugin transform`.
  - Fix: refresh the compiler in the lockfile with `pnpm up -r --depth Infinity @swc/core`. In 2026-10, plugin 6.7.0 needed `@swc/core` 1.16.x. The allowed range comes from `@vitejs/plugin-react-swc`.
  - The plugin's version often trails the other `@lingui/*` packages; that's expected.
- **`@tanstack/react-router` and `@tanstack/router-plugin` are exact pins.** Keep them exact and bump them together. `router-plugin` declares a minimum `@tanstack/react-router` version: check it with `npm view @tanstack/router-plugin@<ver> dependencies peerDependencies`.
- **happy-dom is held below 20.12.**
  - 20.12.0 added `Element.animate()`, so motion runs real Web Animations in tests.
  - happy-dom's `Animation.cancel()` rejects `finished` without marking it handled. The result is about 100 unhandled `AbortError: The animation was canceled` errors, and Vitest exits 1.
  - Upstream: capricorn86/happy-dom#2339 and #2412. Each run, check whether they're fixed before taking 20.12 or later.
- **Obsolete catalog entries**: run `pnpm knip --dependencies`. If it reports an unused dependency, flag it for removal in a separate PR rather than bumping it.
