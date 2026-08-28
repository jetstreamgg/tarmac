import type { BrowserContext, Page } from '@playwright/test';

const GLOBAL_KEY = '__TARMAC_CSP_VIOLATIONS__';

export type CspViolationRecord = {
  blockedURI: string;
  violatedDirective: string;
  effectiveDirective: string;
  disposition: string;
  sample?: string;
};

/**
 * Registers a document-level listener so enforced CSP violations are visible to E2E.
 * Call via BrowserContext.addInitScript before the first navigation.
 */
export async function installCspViolationCollector(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    key => {
      const w = globalThis as unknown as Record<string, CspViolationRecord[] | undefined>;
      const list = w[key] ?? [];
      w[key] = list;
      globalThis.addEventListener('securitypolicyviolation', e => {
        if (e.disposition !== 'enforce') return;
        list.push({
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective,
          effectiveDirective: e.effectiveDirective,
          disposition: e.disposition,
          sample: e.sample
        });
      });
    },
    GLOBAL_KEY
  );
}

export async function readCspViolations(page: Page): Promise<CspViolationRecord[]> {
  return page.evaluate(key => {
    const w = globalThis as unknown as Record<string, CspViolationRecord[] | undefined>;
    return w[key] ?? [];
  }, GLOBAL_KEY);
}

export function formatCspViolations(violations: CspViolationRecord[]): string {
  return violations
    .map(v => {
      const dir = v.effectiveDirective || v.violatedDirective;
      const sample = v.sample ? ` sample=${v.sample}` : '';
      return `[${dir}] blockedURI=${v.blockedURI}${sample}`;
    })
    .join('\n');
}
