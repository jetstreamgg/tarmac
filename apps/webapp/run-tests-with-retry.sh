#!/bin/bash

# First, run stake.spec.ts in isolation with a single worker
# Global setup will handle snapshot revert/funding automatically
# echo "🎯 Running stake.spec.ts in isolation first..."
# pnpm playwright test stake.spec.ts --config=playwright-parallel.config.ts --workers=1

# STAKE_EXIT_CODE=$?

# if [ $STAKE_EXIT_CODE -ne 0 ]; then
#   echo "❌ stake.spec.ts failed"
#   echo "Continuing with other tests..."
# fi

# Detect shard mode
SHARD_INDEX=${PLAYWRIGHT_SHARD_INDEX:-}
SHARD_TOTAL=${PLAYWRIGHT_SHARD_TOTAL:-}
SHARD_ARGS=""

if [ -n "$SHARD_INDEX" ] && [ -n "$SHARD_TOTAL" ]; then
  echo "🔀 Running in SHARD MODE: Shard ${SHARD_INDEX}/${SHARD_TOTAL}"
  SHARD_ARGS="--shard=${SHARD_INDEX}/${SHARD_TOTAL}"
else
  echo "📦 Running in WORKER MODE: Standard parallel execution"
fi

# Now run all OTHER tests in parallel (excluding stake.spec.ts)
# Global setup will handle snapshot revert automatically
echo ""
echo "🚀 Running E2E tests in parallel..."

pnpm playwright test --config=playwright-parallel.config.ts ${SHARD_ARGS}

PARALLEL_EXIT_CODE=$?

if [ $PARALLEL_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "⚠️ Some tests failed. Re-running failed tests serially..."
  echo ""

  # Re-run only the failed tests with a single worker
  # globalSetup will revert snapshots automatically
  pnpm playwright test --last-failed --workers=1 --config=playwright-parallel.config.ts ${SHARD_ARGS}

  RETRY_EXIT_CODE=$?

  if [ $RETRY_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed after retry!"
    exit 0
  else
    echo "❌ Some tests still failing after retry"
    exit 1
  fi
else
    echo "✅ All parallel tests passed"
fi