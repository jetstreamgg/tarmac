#!/bin/bash

# Run tests with automatic retry for failures
# Supports both standard and alternate VNet configurations

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

# Determine which tests to run based on project argument
PROJECT_ARG=""
if [[ "$@" == *"--project=chromium-alternate"* ]] || [[ "$USE_ALTERNATE_VNET" == "true" ]]; then
  echo "🔵 Running alternate VNet tests"
  PROJECT_ARG="--project=chromium-alternate"
  export USE_ALTERNATE_VNET=true
elif [[ "$@" == *"--project=chromium"* ]]; then
  echo "🔵 Running standard tests"
  PROJECT_ARG="--project=chromium"
else
  echo "🔵 Running all tests (standard and alternate)"
fi

# Now run tests in parallel
# Global setup will handle snapshot revert automatically
echo ""
echo "🚀 Running E2E tests in parallel..."

pnpm playwright test --config=playwright-parallel.config.ts ${PROJECT_ARG} ${SHARD_ARGS}

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