---
name: dependency-updates
description: Manually run dependabot-style dependency updates (dependabot doesn't handle pnpm catalogs well). Use when asked to update dependencies, run dependabot manually, or do the monthly dependency bump. Applies the rules from .github/dependabot.yml as catalog edits in pnpm-workspace.yaml, one commit per group, then runs all gates and opens a PR.
---

# Manual dependency updates

Dependabot PRs are unreliable with pnpm catalogs, so version updates are done manually with this procedure. All dependency versions live in the `catalog:` section of `pnpm-workspace.yaml` — every bump is an edit there plus a `pnpm install` to refresh the lockfile.

## 1. Load the rules (do not hardcode them)

Read both files fresh each run — the config evolves:

- `.github/dependabot.yml` — allowed update types, per-dependency ignores, and the group definitions (used for commit granularity). Expect the wallet-connector packages to be patch-only.
- `pnpm-workspace.yaml` — the catalog (current ranges, note `~` vs `^` per entry and preserve the style) and `minimumReleaseAge` (minutes; 10080 = 7 days).

## 2. Create a branch

`chore/dependency-updates-<YYYY-MM>` off `development`.

## 3. Discover and filter updates

1. `pnpm -r outdated --format json` (strip the warning lines before the first `{` when parsing; entries can lack `current`).
2. Classify each as major/minor/patch and drop everything the config ignores.
3. **Age-gate the targets**: pnpm rejects versions younger than `minimumReleaseAge`, so for each package resolve the target as the newest version that (a) satisfies the allowed bump level and (b) was published earlier than now − minimumReleaseAge (`npm view <pkg> time --json`). Writing a too-new lower bound into the catalog makes `pnpm install` fail.
4. Present the resulting list to the user grouped like the dependabot groups, with the excluded majors listed separately, **before applying anything**.

## 4. Apply as grouped commits

One commit per dependabot group (bisectability). For each group: edit the catalog ranges (keep existing `~`/`^` style), run `pnpm install`, commit with a message naming the notable bumps.

## 5. Formatting fallout

If **tailwindcss** or **prettier** was bumped, run `pnpm prettier:check`. A tailwindcss bump alone typically reformats dozens of files: `prettier-plugin-tailwindcss` sorts classes by the canonical order of the _installed_ Tailwind version. Apply `pnpm prettier` as its **own commit** (don't fold it into a group), and attribute the changes correctly in the commit/PR (Tailwind class re-sorting vs. actual prettier restyling).

## 6. Gates

Run all of:

- `pnpm typecheck`
- `pnpm lint` — compare the warning count against `development`; the count must not grow
- `pnpm prettier:check`
- `pnpm test` (unit + vnet hooks; needs `TENDERLY_API_KEY`)
- `pnpm build`
- `pnpm audit --prod --audit-level high`

After the test run, **restore `tenderlyTestnetData.json`** (`git checkout -- tenderlyTestnetData.json`) — the vnet lifecycle rewrites it with ephemeral testnet IDs that are already deleted by teardown. Never commit that churn.

## 7. PR

Push and open a single PR to `development`. The body should list each group's bumps, the excluded majors (with reasons where non-obvious), the formatting-commit attribution if any, and the verification checklist.

## Known pins & recurring checks

- **@metamask/connect-evm stays on 1.x**: it is never imported directly — it only satisfies the peer dependency of wagmi's `metaMask()` connector, and `@wagmi/connectors` (via wagmi) requires `^1.3.0`. Each run, check whether wagmi's current `@wagmi/connectors` has widened that range before considering 2.x.
- Wallet-connector packages are deliberately conservative (patch-only, `~` ranges) — do not "helpfully" widen them.
- If a catalog entry looks obsolete (e.g. a package no longer imported anywhere), flag it for removal in a separate PR rather than bumping it.
