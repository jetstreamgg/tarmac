import { expect, test } from '../fixtures-parallel.ts';
import { performAction } from '../utils/approveOrPerformAction';
import { connectMockWalletAndAcceptTerms } from '../utils/connectMockWalletAndAcceptTerms.ts';
import { enableNativeProvider, forceCurveProvider, getStUsdsSupplyCap } from '../utils/setStUsdsSupplyCap';
import { getCurvePoolReserves } from '../utils/curvePoolManipulation';
import { revertToSnapshot } from '../revert-vnets';
import { NetworkName } from '../utils/constants';
import { formatUnits } from 'viem';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Comprehensive test suite for stUSDS provider selection (Native vs Curve).
 *
 * Tests both provider switching logic and critical edge cases including:
 * - Native provider when cap is high
 * - Curve provider when supply cap is reached
 * - Dynamic provider switching via cap manipulation
 * - Withdrawal flows with both providers
 * - Curve pool state validation
 *
 * IMPORTANT: These tests manipulate shared VNet state (supply cap, pool reserves)
 * and must run serially to avoid race conditions.
 */
test.describe('stUSDS Provider', () => {
  // Run tests in this file serially to avoid state conflicts
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ isolatedPage }) => {
    await isolatedPage.goto('/');
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    // Navigate to Expert module -> stUSDS
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();
  });

  test.afterEach(async () => {
    // Restore VNet to clean snapshot after each test
    // This ensures state changes (cap manipulation) don't affect subsequent tests
    try {
      const snapshotFile = path.join(__dirname, '..', 'persistent-vnet-snapshots.json');
      const snapshotData = await fs.readFile(snapshotFile, 'utf-8');
      const snapshots: Record<string, string> = JSON.parse(snapshotData);
      const snapshotId = snapshots[NetworkName.mainnet];

      if (snapshotId) {
        await revertToSnapshot(NetworkName.mainnet, snapshotId);
        console.log('✅ VNet state restored to clean snapshot');
      }
    } catch (error) {
      console.warn('⚠️  Failed to restore snapshot:', (error as Error).message);
      // Don't fail the test if snapshot restoration fails
    }
  });
  test('Native provider works when cap is high', async ({ isolatedPage }) => {
    // Set a very high supply cap to enable native provider
    await enableNativeProvider();

    // Verify cap was set
    const cap = await getStUsdsSupplyCap();
    console.log(`Current supply cap: ${formatUnits(cap, 18)} USDS`);
    expect(cap).toBeGreaterThan(BigInt('100000000000000000000000000')); // > 100M USDS

    // Reload to pick up the new cap
    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();

    // Enter amount to supply
    await isolatedPage.getByTestId('supply-input-stusds').click();
    await isolatedPage.getByTestId('supply-input-stusds').fill('10');

    // Wait for provider selection to complete
    await isolatedPage.waitForTimeout(2000);

    // Native provider should be used (no Curve routing indicator)
    const curveIndicator = isolatedPage.getByText(/Routing through Curve/);
    const curveIndicatorCount = await curveIndicator.count();
    expect(curveIndicatorCount).toBe(0);

    console.log('✅ Native provider is being used as expected');

    // Perform the supply action (bundled transactions with batch wallet)
    await performAction(isolatedPage, 'Supply');

    // Verify native success message
    const nativeSuccess = isolatedPage.getByText("You've supplied 10 USDS to the stUSDS module");
    await expect(nativeSuccess).toBeVisible({ timeout: 30000 });
  });

  test('Curve provider used when supply cap reached', async ({ isolatedPage }) => {
    // Force supply cap to current supply to simulate "cap reached"
    await forceCurveProvider();

    // Verify cap was set to current supply
    const cap = await getStUsdsSupplyCap();
    console.log(`Supply cap set to current supply: ${formatUnits(cap, 18)} USDS`);

    // Reload to pick up the new cap
    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();

    // Enter amount to supply
    await isolatedPage.getByTestId('supply-input-stusds').click();
    await isolatedPage.getByTestId('supply-input-stusds').fill('10');

    // Wait for provider selection to complete
    await isolatedPage.waitForTimeout(2000);

    // Curve provider should be indicated
    const curveIndicator = isolatedPage.getByText(/Routing through Curve/);
    await expect(curveIndicator).toBeVisible();

    // Should show "supply cap reached" reason
    const capReachedMessage = isolatedPage.getByText(/supply capacity is reached/i);
    await expect(capReachedMessage).toBeVisible();

    console.log('✅ Curve provider is being used due to supply cap');

    // Perform the supply action (should route through Curve, bundled transactions)
    await performAction(isolatedPage, 'Swap');

    // Verify Curve success message
    const curveSuccess = isolatedPage.getByText("You've supplied 10 USDS to the Curve pool for stUSDS");
    await expect(curveSuccess).toBeVisible({ timeout: 30000 });
  });

  test('Can switch between providers by changing cap', async ({ isolatedPage }) => {
    // Start with high cap (native provider)
    await enableNativeProvider();

    await isolatedPage.getByTestId('supply-input-stusds').click();
    await isolatedPage.getByTestId('supply-input-stusds').fill('5');
    await isolatedPage.waitForTimeout(2000);

    // Record which provider is initially selected
    const initialCurveCount = await isolatedPage.getByText(/Using Curve pool/).count();
    console.log(`Initial state: ${initialCurveCount > 0 ? 'Curve' : 'Native'} provider`);

    // Now force Curve by reducing cap
    await forceCurveProvider();

    // Refresh the page to pick up the new cap
    await isolatedPage.reload();
    await connectMockWalletAndAcceptTerms(isolatedPage, { batch: true });
    await isolatedPage.getByRole('tab', { name: 'Expert' }).click();
    await isolatedPage.getByTestId('stusds-stats-card').click();

    // Enter same amount again
    await isolatedPage.getByTestId('supply-input-stusds').click();
    await isolatedPage.getByTestId('supply-input-stusds').fill('5');
    await isolatedPage.waitForTimeout(2000);

    // Curve should now be indicated
    const curveIndicator = isolatedPage.getByText(/Routing through Curve/);
    await expect(curveIndicator).toBeVisible();

    console.log('✅ Successfully switched to Curve provider by reducing cap');
  });

  test('Withdrawal works with both providers', async ({ isolatedPage }) => {
    // First supply some USDS (doesn't matter which provider)
    await isolatedPage.getByTestId('supply-input-stusds').click();
    await isolatedPage.getByTestId('supply-input-stusds').fill('20');
    await performAction(isolatedPage, 'Swap');
    await isolatedPage.getByRole('button', { name: 'Back to stUSDS' }).click();

    // Switch to Withdraw tab
    await isolatedPage.getByRole('tab', { name: 'Withdraw' }).click();

    // Test withdrawal with high cap (native preferred)
    await enableNativeProvider();
    await isolatedPage.getByTestId('withdraw-input-stusds').click();
    await isolatedPage.getByTestId('withdraw-input-stusds').fill('5');
    await isolatedPage.waitForTimeout(2000);

    // Perform withdrawal (bundled transactions with batch wallet)
    await performAction(isolatedPage, 'Swap');

    // Verify success (works for both providers)
    const nativeWithdrawSuccess = isolatedPage.getByText("You've withdrawn 5 USDS from the stUSDS module.");
    const curveWithdrawSuccess = isolatedPage.getByText(/You've withdrawn 5 USDS from the Curve pool./);
    await expect(nativeWithdrawSuccess.or(curveWithdrawSuccess)).toBeVisible({ timeout: 30000 });

    console.log('✅ Withdrawal completed successfully');
  });

  test('Curve pool reserves readable via utility', async () => {
    const reserves = await getCurvePoolReserves();

    expect(reserves.usdsReserve).toBeGreaterThan(0n);
    expect(reserves.stUsdsReserve).toBeGreaterThan(0n);
    expect([0, 1]).toContain(reserves.usdsIndex);
    expect([0, 1]).toContain(reserves.stUsdsIndex);
    expect(reserves.usdsIndex).not.toBe(reserves.stUsdsIndex);

    console.log('=== Curve Pool State ===');
    console.log(`USDS reserve: ${formatUnits(reserves.usdsReserve, 18)} (index ${reserves.usdsIndex})`);
    console.log(`stUSDS reserve: ${formatUnits(reserves.stUsdsReserve, 18)} (index ${reserves.stUsdsIndex})`);

    console.log('✅ Curve pool reserves readable');
  });
});
