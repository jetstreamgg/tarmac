#!/bin/bash

# Usage: `./generate_pr_description.sh [base-branch]`
# Example: `./generate_pr_description.sh origin/devevelopmetn`

# Note: You may need to run `chmod +x generate_pr_description.sh` to make it executable

# Default base branch is origin/main if none provided
BASE_BRANCH=${1:-origin/main}
PR_TEMPLATE_PATH="./.github/pull_request_template.md"

# Files and directories to ignore in the diff
# Add patterns here to exclude files/directories from PR description generation
# Supports glob patterns (e.g., "*.po") and directory paths (e.g., "locales/")
IGNORE_PATTERNS=(
  "pnpm-lock.yaml"
  "*.po"
  "locales/"
  "**/locales/*.ts"
  "packages/utils/src/locales/*.ts"
  "package-lock.json"
  "yarn.lock"
  "*.log"
  ".DS_Store"
  "packages/hooks/src/generated.ts"
)

# Check if PR template exists
if [[ ! -f "$PR_TEMPLATE_PATH" ]]; then
  echo "❌ PR template not found at $PR_TEMPLATE_PATH"
  exit 1
fi

# Check that base branch exists locally or remotely
if ! git rev-parse --verify "$BASE_BRANCH" &> /dev/null; then
  echo "❌ Base branch '$BASE_BRANCH' not found."
  exit 1
fi

# Build git diff command with ignore patterns
PATHSPEC_EXCLUDES=()
for pattern in "${IGNORE_PATTERNS[@]}"; do
  PATHSPEC_EXCLUDES+=(":(exclude)$pattern")
done

# Get git diff against the specified base branch (excluding ignored patterns)
echo "🔍 Generating diff against $BASE_BRANCH (ignoring: ${IGNORE_PATTERNS[*]})"
if [ ${#PATHSPEC_EXCLUDES[@]} -gt 0 ]; then
  GIT_DIFF=$(git diff "$BASE_BRANCH"...HEAD -- "${PATHSPEC_EXCLUDES[@]}")
else
  GIT_DIFF=$(git diff "$BASE_BRANCH"...HEAD)
fi

# Read PR template
PR_TEMPLATE_CONTENT=$(cat "$PR_TEMPLATE_PATH")

# Build prompt
PROMPT=$(printf "Fill in the following GitHub PR template using the code diff below. Be concise but informative.\n\nPR Template:\n------------\n%s\n\nCode Diff (diff against %s):\n----------------------------\n%s\n" "$PR_TEMPLATE_CONTENT" "$BASE_BRANCH" "$GIT_DIFF")

# Copy to clipboard
if command -v wl-copy &> /dev/null; then
  echo "$PROMPT" | wl-copy
  echo "✅ Prompt copied to clipboard using wl-copy."
elif command -v xclip &> /dev/null; then
  echo "$PROMPT" | xclip -selection clipboard
  echo "✅ Prompt copied to clipboard using xclip."
elif command -v pbcopy &> /dev/null; then
  echo "$PROMPT" | pbcopy
  echo "✅ Prompt copied to clipboard using pbcopy."
else
  echo "⚠️  No clipboard tool found. Prompt not copied."
fi

# Optional: preview
echo -e "\n--- Prompt Preview (first 80 lines) ---"
echo "$PROMPT" | head -n 80