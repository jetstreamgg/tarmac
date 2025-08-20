# Stagehand Integration Guide

This guide explains how to use Stagehand AI capabilities in our e2e test automation.

## Overview

Stagehand is an AI-powered browser automation library that extends Playwright with natural language capabilities. It allows you to:

- Write tests using natural language commands
- Extract complex information from pages using AI
- Create more resilient tests that adapt to UI changes
- Simplify complex interaction flows

## Setup

### 1. Install Dependencies

```bash
pnpm add -D @browserbasehq/stagehand
```

### 2. Configure Environment Variables

Copy the example configuration:

```bash
cp .env.stagehand.example .env.stagehand
```

Edit `.env.stagehand` with your settings:

#### Option A: Local Mode (Recommended for Development)

```env
USE_STAGEHAND=true
STAGEHAND_ENV=LOCAL
STAGEHAND_HEADLESS=false  # See browser during tests
OPENAI_API_KEY=your_openai_key  # Or use Google/Anthropic
```

#### Option B: BrowserBase Mode (For CI/Cloud)

```env
USE_STAGEHAND=true
STAGEHAND_ENV=BROWSERBASE
BROWSERBASE_API_KEY=your_api_key
BROWSERBASE_PROJECT_ID=your_project_id
OPENAI_API_KEY=your_openai_key
```

### 3. Get API Keys

#### For AI Models (Required)

Choose one of:

- **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com)
- **Google Gemini**: Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **Anthropic Claude**: Get API key from [Anthropic Console](https://console.anthropic.com)

#### For BrowserBase (Optional - only for cloud mode)

1. Sign up at [BrowserBase](https://browserbase.com)
2. Create a new project
3. Copy your API key and project ID

## Running Tests

### Local Mode (No External Dependencies)

```bash
# Quick start - runs locally with visible browser
USE_STAGEHAND=true STAGEHAND_ENV=LOCAL STAGEHAND_HEADLESS=false pnpm e2e

# Or use the configured .env.stagehand file
source .env.stagehand && pnpm e2e:stagehand
```

### BrowserBase Mode (Cloud Infrastructure)

```bash
# Run on BrowserBase cloud
USE_STAGEHAND=true STAGEHAND_ENV=BROWSERBASE pnpm e2e:stagehand
```

### Standard Playwright Mode (No AI)

```bash
# Regular e2e tests without Stagehand
pnpm e2e
```

### Running Specific Tests

```bash
# Run specific test file with Stagehand
USE_STAGEHAND=true pnpm playwright test stagehand-trade.spec.ts

# Run with UI mode for debugging
USE_STAGEHAND=true pnpm e2e:stagehand:ui
```

## Writing Tests with Stagehand

### Using the Extended Fixtures

Import from `stagehand-fixtures.ts` instead of regular fixtures:

```typescript
import { test, expect } from '../stagehand-fixtures';

test('My test', async ({ stagehandPage, stagehand }) => {
  // stagehandPage: Page object (Stagehand or regular Playwright)
  // stagehand: Stagehand instance (null if disabled)
});
```

### Natural Language Actions

Use the `act()` method for natural language commands:

```typescript
// Instead of complex selectors
await page.getByTestId('trade-input-origin').fill('100');

// Use natural language
await stagehandPage.act('Enter 100 in the trade amount field');
```

### Information Extraction

Use the `extract()` method to get information:

```typescript
// Extract complex information
const balance = await stagehandPage.extract('What is my current ETH balance?');
const fees = await stagehandPage.extract('What are the gas fees for this transaction?');
```

### Hybrid Approach with Fallbacks

Use helper functions for backward compatibility:

```typescript
import { performAction } from '../utils/stagehand-helpers';

await performAction(
  stagehandPage,
  'Click the connect wallet button', // Stagehand command
  async () => {
    // Playwright fallback
    await stagehandPage.getByRole('button', { name: 'Connect Wallet' }).click();
  }
);
```

## Migration Strategy

### Phase 1: Add Stagehand Support to Critical Tests

1. Start with high-value test scenarios
2. Use the hybrid approach with fallbacks
3. Validate both modes work correctly

### Phase 2: Gradual Migration

1. Convert complex selector-based tests
2. Replace brittle locators with AI commands
3. Add AI-powered validation

### Phase 3: Full Adoption

1. New tests use Stagehand by default
2. Legacy tests remain for fallback
3. Monitor and optimize AI usage

## AI Model Selection

### Available Models

The integration supports multiple AI providers:

```env
# OpenAI Models
STAGEHAND_MODEL=gpt-4o  # Most capable (default)
STAGEHAND_MODEL=gpt-4o-mini  # Faster, cheaper

# Google Models
STAGEHAND_MODEL=google/gemini-2.0-flash  # Fast and efficient

# Anthropic Models
STAGEHAND_MODEL=anthropic/claude-3-5-sonnet-latest  # High quality
```

### Performance vs Cost Trade-offs

| Model             | Speed     | Cost | Quality   | Best For                  |
| ----------------- | --------- | ---- | --------- | ------------------------- |
| gpt-4o-mini       | Fast      | Low  | Good      | Development, simple tests |
| gemini-2.0-flash  | Very Fast | Low  | Good      | Rapid iteration           |
| gpt-4o            | Moderate  | High | Excellent | Complex scenarios         |
| claude-3-5-sonnet | Moderate  | High | Excellent | Nuanced understanding     |

## Best Practices

### 1. Use Descriptive Commands

```typescript
// Good
await page.act('Click the blue Submit button in the trade confirmation modal');

// Less specific
await page.act('Click submit');
```

### 2. Combine AI with Assertions

```typescript
// Use AI for interaction
await page.act('Complete the token swap for 100 USDS');

// Use Playwright for precise assertions
const balance = await page.getByTestId('usds-balance').textContent();
expect(parseFloat(balance)).toBeGreaterThan(99);
```

### 3. Handle AI Failures Gracefully

```typescript
try {
  await page.act('Complex AI action');
} catch (error) {
  // Fallback to standard Playwright
  await page.click('#fallback-selector');
}
```

### 4. Use Helper Classes for Common Patterns

```typescript
import { createDeFiActions } from '../utils/stagehand-helpers';

const defi = createDeFiActions(stagehandPage);
await defi.swapTokens('100', 'USDS', 'SKY');
await defi.stakeTokens('50', 'SKY');
```

## DeFi-Specific Helpers

The `DeFiActions` class provides pre-built methods for common DeFi operations:

- `connectWallet(walletName)` - Connect a wallet
- `swapTokens(amount, from, to)` - Perform token swaps
- `stakeTokens(amount, token)` - Stake tokens
- `getBalance(token)` - Get token balance
- `approveToken(token)` - Approve token spending
- `claimRewards()` - Claim available rewards

## Debugging

### Enable Debug Logging

```env
STAGEHAND_DEBUG=true
```

### View AI Decisions

```typescript
const decision = await page.extract('Explain what elements you see on this page');
console.log('AI Analysis:', decision);
```

### Check Stagehand Status

```typescript
import { isStagehandEnabled } from '../stagehand-fixtures';

if (isStagehandEnabled()) {
  console.log('Stagehand is active');
}
```

## Cost Considerations

- Each `act()` and `extract()` call uses AI tokens
- Batch operations when possible
- Use standard Playwright for simple, stable interactions
- Monitor usage in BrowserBase dashboard

## Troubleshooting

### Common Issues

1. **Stagehand not initializing**
   - Check environment variables
   - Verify API keys are valid
   - Ensure BrowserBase project exists

2. **AI commands failing**
   - Make descriptions more specific
   - Verify page is fully loaded
   - Check if elements are visible

3. **Tests running slowly**
   - AI operations add latency
   - Optimize by reducing AI calls
   - Use parallel test execution

4. **Mock wallet not working in Stagehand tests**
   - The integration automatically injects mock wallet support
   - Stagehand tests should connect to the same mock wallet as regular tests
   - If issues persist, check browser console for `window.FORCE_MOCK_WALLET` flag

### Support

- BrowserBase docs: https://docs.browserbase.com
- Stagehand docs: https://docs.stagehand.dev
- Internal issues: Create ticket in project repository

## Examples

See the following test files for examples:

- `stagehand-trade.spec.ts` - Pure Stagehand tests
- `stagehand-migration-example.spec.ts` - Hybrid approach
- `utils/stagehand-helpers.ts` - Helper utilities
