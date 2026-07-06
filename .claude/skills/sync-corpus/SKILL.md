---
name: sync-corpus
description: Sync webapp content (banners, FAQs, tooltips, speed-bumps) from the sky-ecosystem/corpus repo
argument-hint: [branch-name] [file-types] — e.g. "vaults-edits banners,faqs" or just "main"
---

# Sync Corpus Content

Syncs webapp content from the `sky-ecosystem/corpus` repo's generated output files into the tarmac codebase.

## Arguments

- **First arg**: Branch name in sky-ecosystem/corpus (default: `development`)
- **Remaining args**: Comma-separated file types to sync (default: all). Options: `banners`, `faqs`, `tooltips`, `speed-bumps`

Example invocations:

- `/sync-corpus vaults-edits` — sync all content from vaults-edits branch
- `/sync-corpus main banners,faqs` — sync only banners and FAQs from main
- `/sync-corpus` — sync all content from development branch

## File Mapping

### Banners

- **Corpus**: `output/webapp/banner/banners.ts`
- **Tarmac**: `apps/webapp/src/data/banners/banners.ts`
- Only sync entries where `module` is `vaults-banners` or other relevant modules. The tarmac file may have a different TypeScript interface shape (no trailing commas, etc.) — compare content semantically, not formatting.

### FAQs

- **Corpus**: `output/webapp/faq/*.ts`
- **Tarmac**: `apps/webapp/src/data/faqs/*.ts`
- Compare only files that exist in both locations. Files only in corpus or only in tarmac should be reported but not modified.

### Tooltips

- **Corpus**: `output/webapp/tooltips/tooltips.ts`
- **Tarmac**: `packages/widgets/src/data/tooltips/index.ts`

### Speed-bumps

- **Corpus**: `output/webapp/speed-bumps/*.ts`
- **Tarmac**: `apps/webapp/src/data/chat/speed-bumps/*.ts`
- Compare only files that exist in both locations.

## Process

### Step 1: Resolve the source commit, then fetch corpus files

First pin the exact commit the sync is reading from (the branch name alone is a moving target):

```
gh api repos/sky-ecosystem/corpus/commits/<branch> --jq .sha
```

Record this SHA — it goes in the sync log (Step 5). Then fetch raw content **at that SHA** (not the branch) so the fetch and the recorded provenance can't diverge mid-run:

```
gh api "repos/sky-ecosystem/corpus/contents/output/webapp/<path>?ref=<sha>" -H "Accept: application/vnd.github.raw+json"
```

Save fetched files to `/tmp/corpus-sync/` for diffing.

### Step 2: Diff and report

For each file type requested:

1. Fetch the corpus version
2. Diff against the local tarmac version
3. Ignore formatting-only differences (trailing commas, whitespace, quote style)
4. Report **content-only** differences to the user — show the actual text changes

### Step 3: Apply changes

For each content difference found:

1. Show the user what will change (old text → new text)
2. Apply the content update to the tarmac file using the Edit tool
3. Preserve the existing tarmac file formatting (no trailing commas unless the file already uses them, same quote style, etc.)

### Step 4: Summary

Report:

- Files synced with changes
- Files already in sync
- Files only in corpus (not yet in tarmac)
- Files only in tarmac (not in corpus)

### Step 5: Record the sync (provenance)

Always do this, even when no content changed — "checked, nothing changed" is itself a useful log entry.

**Do NOT hand-edit `version.ts` or the log.** Both sync paths (this skill and `sync-content.sh`) record provenance through the **same** helper so their output is byte-identical. Run it from the repo root:

```
node apps/webapp/scripts/record-corpus-sync.mjs \
  --branch "<branch>" \
  --commit "<sha from Step 1>" \
  --tag "<corpus release tag, or omit>" \
  --file-types "<types synced, e.g. banners,faqs>" \
  --changed "<comma-separated tarmac paths edited this run, or omit>" \
  --in-sync <count already in sync, or omit>
```

It overwrites `apps/webapp/src/data/version.ts` (`CORPUS_VERSION`/`CORPUS_BRANCH`/`CORPUS_COMMIT`) and appends one line to `apps/webapp/src/data/corpus-sync-log.jsonl`.

- `--tag`: best-effort latest corpus release tag — `gh api repos/sky-ecosystem/corpus/releases/latest --jq .tag_name`; omit if none (logs `version: null`).
- `--file-types`: the types actually synced this run (default: all four).
- `--changed` / `--in-sync`: from your Step 2 diff. Omit both for a pointer-only update (log `result` is null).
- Add `--dry-run` to preview both outputs without writing.
