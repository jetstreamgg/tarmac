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

### Step 1: Fetch corpus files

Use `gh api` to fetch the raw content from the specified branch:

```
gh api "repos/sky-ecosystem/corpus/contents/output/webapp/<path>?ref=<branch>" -H "Accept: application/vnd.github.raw+json"
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
