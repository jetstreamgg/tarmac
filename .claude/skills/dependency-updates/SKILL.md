---
name: dependency-updates
description: Manually run dependabot-style dependency updates (dependabot doesn't handle pnpm catalogs well). Use when asked to update dependencies, run dependabot manually, or do the monthly dependency bump. Applies the rules from .github/dependabot.yml as catalog edits in pnpm-workspace.yaml, one commit per group, then runs all gates and opens a PR.
---

# Manual dependency updates

Dependabot PRs are unreliable with pnpm catalogs, so version updates are done manually with this procedure. All dependency versions live in the `catalog:` section of `pnpm-workspace.yaml`: every bump is an edit there plus a `pnpm install` to refresh the lockfile.

The scripts in `scripts/` do the mechanical parts. Run them from the repo root:

- `plan-updates.mjs` finds every catalog entry that can move and its target version, sorted by group.
- `bump-catalog.mjs` edits catalog versions and keeps each entry's `^`, `~` or exact style, and any trailing comment.
- `check-overrides.mjs` reports which `overrides:` entries are still needed (see Known pins & recurring checks).

They share `lib.mjs`. If you change any of them, run `node --test .claude/skills/dependency-updates/scripts/lib.test.mjs`.

## 0. Preflight

- **Node**: use the version in `.nvmrc` (24). If `node -v` reports something older, put that Node first on `PATH` for every command in the run. pnpm only warns about the `engines` mismatch, but it adds non-JSON noise to its output, and the planning script refuses to run on an older Node.
- **`.env`** with `TENDERLY_API_KEY` must exist at the repo root; `pnpm test` needs it. A fresh worktree may not have one.

## 1. Load the rules (do not hardcode them)

`plan-updates.mjs` reads both files on every run. Read them yourself too, since the config changes over time and the comments explain the exceptions:

- `.github/dependabot.yml`: allowed update types, per-dependency ignores (`update-types` and `versions`), and the group definitions (used for commit granularity). Expect the wallet-connector packages to be patch-only.
- `pnpm-workspace.yaml`: the catalog and `minimumReleaseAge` (minutes; 10080 = 7 days).

## 2. Branch

Work on `chore/dependency-updates-<YYYY-MM>`, based on a freshly fetched `origin/development`. If you're already on a new branch with no commits beyond `development`, for example one created by your worktree tool, rename it with `git branch -m` rather than leaving it behind. Then bring it up to date with `git merge --ff-only origin/development`, so the plan reads the current catalog and lockfile.

## 3. Plan the updates

```bash
node .claude/skills/dependency-updates/scripts/plan-updates.mjs
```

For each catalog entry, the script picks the newest stable version that:

- is newer than what the lockfile resolves today. Like dependabot, it measures the bump level from the installed version, not the catalog floor.
- is not deprecated and not above the npm `latest` dist-tag
- the dependabot ignore rules allow (`update-types` and `versions`), and
- was published before now − `minimumReleaseAge`, unless the package is in `minimumReleaseAgeExclude`. Writing a too-new lower bound into the catalog makes `pnpm install` fail.

It assigns each bump to the dependabot group with the most specific matching pattern, as dependabot does, and prints a ready-to-run `bump-catalog.mjs` command per group. More sections follow:

- **Floor-only**: the catalog floor trails what the lockfile already resolves, and there is nothing newer to take. These aren't updates, so they're left out of the apply commands.
- **Held back**: why the latest version wasn't taken (a major, patch-only, too young, or excluded by a `versions` rule).
- **Errors**: packages that could not be planned, for example a malformed `versions` rule or a registry error. The script exits 1 when this section isn't empty. Fix the cause instead of planning those packages by hand.

The script refuses to run at all if a config file uses YAML it can't parse, rather than silently dropping rules.

Long-term holds belong in `.github/dependabot.yml` as `versions` ignore rules, so dependabot and the script both respect them. Couplings the script can't see are listed in **Known pins & recurring checks** below; go through that list and adjust the plan by hand. Also look at any row flagged `0.x minor`: semver treats those as breaking.

Present the resulting list to the user grouped like the dependabot groups, with the held-back majors listed separately, **before applying anything**.

## 4. Review release notes (before step 5)

The gates don't catch runtime behavior changes. In 2026-08, viem's `parseUnits('')` started throwing and broke every widget input, with all gates green. Review every bump's release notes for:

- behavior changes
- deprecations
- fixes to APIs the app calls

Finish this review before applying anything. Holding a package back after its group is committed doesn't work cleanly: lowering the catalog floor doesn't downgrade the lockfile, and rewriting the commit conflicts in `pnpm-lock.yaml`.

If your harness supports subagents, start one read-only agent per group (in Claude Code: `Explore`), all in parallel. Give each agent its group's `pkg from → to` list and ask it to:

- read the changelog or GitHub releases for every version in each range, and
- search for the affected APIs in `apps/webapp/src` and in the config files (`apps/webapp/*.config.ts` and the root `*.config.*`). Build and lint plugins are only used there.

Ask for a short risk list (package, change, affected call sites, how to check it), not a changelog summary. Without subagents, do the same review sequentially, starting with web3-tools and infrastructure.

Adjust the plan with the findings before step 5: hold a risky package back (and say why in the PR), or plan a code change as its own commit. Put the findings in the PR body.

## 5. Apply as grouped commits

One commit per dependabot group (bisectability). For each group:

1. Run the `bump-catalog.mjs` command from the plan.
2. Run `pnpm install`.
3. Commit with a message naming the notable bumps.

If a gate later needs a fix that belongs to one group, fold it into that group's commit so every commit still builds. A coupled transitive bump is an example (see Known pins). Use `git commit --fixup=<sha>` followed by `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --keep-base origin/development`. `--keep-base` keeps the commits on the base the gates ran against, instead of moving them onto a newer `origin/development`.

## 6. Formatting fallout

If **tailwindcss** or **prettier** was bumped, run `pnpm prettier:check`. A tailwindcss bump alone typically reformats dozens of files: `prettier-plugin-tailwindcss` sorts classes by the canonical order of the _installed_ Tailwind version.

Format only the flagged files that git tracks:

```bash
git ls-files -z | xargs -0 pnpm exec prettier --list-different --ignore-unknown | xargs pnpm exec prettier --write
```

Avoid `pnpm prettier`: it rewrites everything under `.`, including nested checkouts such as `.claude/worktrees/*`. Put the result in its **own commit** (don't fold it into a group). Attribute the changes correctly in the commit and the PR: Tailwind class re-sorting vs. actual prettier restyling.

## 7. Gates

Run them from a checkout without nested worktrees (a worktree of its own, for example). `pnpm lint` and `pnpm prettier:check` scan `.`, so in a main checkout that holds `.claude/worktrees/*` they also report other branches' files.

1. Run `pnpm build` first and on its own. It starts with `pnpm messages`, which rewrites the compiled catalogs in `apps/webapp/src/locales` that the other gates read.
2. Then start `pnpm test` in the background. It runs the unit suite plus the vnet hooks suite, takes about 3–5 minutes, and needs `TENDERLY_API_KEY`. Never run two vnet-backed test runs at once.
3. While it runs, run these in parallel:
   - `pnpm typecheck`
   - `pnpm lint`. It runs with `--max-warnings 0`, so passing already proves the warning count didn't grow.
   - `pnpm prettier:check`
   - `pnpm audit --prod --audit-level high`

`pnpm test` is green only when the command exits 0:

- Vitest can exit 1 while every test passes. Check the summary's `Errors` line for unhandled rejections.
- The hooks suite only runs if the unit suite exits 0. If the unit suite failed, the hooks suite never ran, so rerun the full `pnpm test` after the fix.

Clean up after the test run:

- If `pnpm test` failed after the vnet fork started, the vnet was not deleted. Run `pnpm vnet:delete` first; it reads the testnet IDs from `tenderlyTestnetData.json`.
- Then **restore `tenderlyTestnetData.json`** with `git checkout -- tenderlyTestnetData.json`. The vnet lifecycle rewrites it with ephemeral testnet IDs. Never commit that churn.
- Run `git status`. If `apps/webapp/src/routeTree.gen.ts` changed (a `@tanstack/router-plugin` bump can change its generated output), check the diff and commit it on its own. CI typechecks the committed file.

## 8. PR and CI

Push and open a single PR to `development`. The body should list:

- each group's bumps
- the held-back packages (with reasons where non-obvious)
- the release-note risks from step 4
- the formatting-commit attribution, if any
- the verification checklist

Then watch CI (`gh pr checks <number> --watch`). If e2e shards fail, use the `e2e-repair` skill to diagnose them, but push any fix to this PR's branch: that skill's shipping instructions still target the retired `app-redesign` branch. Before blaming the bumps, check whether the same job is also red on `development`'s latest run.

Then handle Dependabot's open PRs. They're the team's monthly reminder for this run, and a cross-check of the plan:

1. List them with `gh pr list --author app/dependabot --state open`, and read each one's bump list.
2. Any package a Dependabot PR bumps that this PR doesn't (or bumps to a lower version) must have a reason in this PR's body. This month that was happy-dom, held back on purpose.
3. Close each Dependabot PR whose bumps this PR fully covers, at the same or a newer version, with `gh pr close <n> --comment "Superseded by #<this PR>."`.
4. Leave every other Dependabot PR open and mention it in your summary. This mostly concerns security-update PRs, which aren't part of the monthly run.

When web3-tools moved by more than a patch, smoke-test a transaction flow on a Tenderly fork. This is optional for smaller bumps.

1. Run `pnpm vnet:fork`, then `pnpm -F webapp dev:mock` and use the mock wallet.
2. Afterwards, stop the dev server and run `pnpm vnet:delete`.
3. Then `git checkout -- tenderlyTestnetData.json`.

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
- **happy-dom is held below 20.12** by a `versions` ignore rule in `.github/dependabot.yml`.
  - 20.12.0 added `Element.animate()`, so motion runs real Web Animations in tests.
  - happy-dom's `Animation.cancel()` rejects `finished` without marking it handled. The result is about 100 unhandled `AbortError: The animation was canceled` errors, and Vitest exits 1.
  - Upstream: capricorn86/happy-dom#2339 and #2412. Each run, check whether they're fixed; if so, remove the rule.
- **Overrides**: run `node .claude/skills/dependency-updates/scripts/check-overrides.mjs`.
  - It removes every override in a temp copy, re-resolves the lockfile, and checks each override's selector against the result.
  - `removable`: nothing the selector targets would be installed without it. Delete those entries from `overrides:`, run `pnpm install`, and commit that as its own commit. The audit gate in step 7 must still pass.
  - `needed`: keep it. The detail column shows the version that would come back.
  - `review`: an unconditional override, or a selector the script can't evaluate. Decide by hand.
  - Also go through the watchlist comment above `overrides:` (advisories deliberately left unoverridden). If upstream now publishes a fix, add a range-scoped override following the conventions in that comment, or drop the watchlist entry if the package left the tree.
- **Obsolete catalog entries**:
  - Run `pnpm knip --dependencies`. If it reports an unused dependency, flag it for removal in a separate PR rather than bumping it.
  - knip never reports packages listed in `knip.json`'s `ignoreDependencies`. Check those by hand: search for imports and config usage.
