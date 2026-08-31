import { expect, type Page } from '@playwright/test';

/**
 * Waits for a transaction to confirm.
 *
 * A confirmed transaction closes its own modal and hands the outcome to a toast
 * (Figma 859:35901), so the toast — not the modal's status badge or its success
 * screen — is the terminal signal. Anything the spec wants to assert INSIDE the
 * modal (step rows, the hero, the badge) has to be asserted before this call.
 *
 * The toast is dismissed on the way out: its id is stable, so a second
 * transaction in the same spec would replace this one's content in place and a
 * later wait could otherwise pass against the previous outcome.
 */
export const expectTransactionSuccess = async (
  page: Page,
  { title, timeout = 60_000 }: { title?: string | RegExp; timeout?: number } = {}
) => {
  const toast = page
    .locator('[data-sonner-toast]')
    .filter({ has: page.getByTestId('transaction-success-toast') });
  await expect(toast).toBeVisible({ timeout });
  if (title !== undefined) {
    await expect(toast).toContainText(title);
  }
  await toast.getByRole('button', { name: 'Close notification' }).click();
  await expect(toast).toHaveCount(0);
};
