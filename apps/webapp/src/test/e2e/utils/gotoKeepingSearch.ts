import { type Page } from '@playwright/test';

// Deep-link navigation that preserves the current URL's search params
// (`network=` after switchToL2, `details=`, ...). This replaces clicking the
// legacy module nav (`widget-navigation`), which the B4 chrome retirement
// removed — see e2e-migration.md. Params already present in `path` win over
// the current URL's.
export const gotoKeepingSearch = async (page: Page, path: string) => {
  const current = new URL(page.url());
  const target = new URL(path, current.origin);
  current.searchParams.forEach((value, key) => {
    if (!target.searchParams.has(key)) {
      target.searchParams.set(key, value);
    }
  });
  await page.goto(target.pathname + target.search);
};
