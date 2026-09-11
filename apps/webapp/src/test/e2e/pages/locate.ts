import { type Locator, type Page } from '@playwright/test';
import { type LocatorSpec, type TestContract } from '../contracts/types';

function formatContractContext(contract: TestContract): string {
  const frames = contract.figma.frames.join(', ');
  return `[contract:${contract.id} qa:${contract.qaCase ?? '—'} figma:${frames}] ${contract.intent}`;
}

/** Resolve a locator from a contract step spec. Fails with repair context. */
export function locate(page: Page, spec: LocatorSpec, contract: TestContract): Locator {
  if (spec.testId) {
    return page.getByTestId(spec.testId);
  }
  if (spec.role) {
    return page.getByRole(spec.role.type, spec.role.name ? { name: spec.role.name } : undefined);
  }
  if (spec.label) {
    return page.getByLabel(spec.label);
  }
  throw new Error(`No locator resolved — ${formatContractContext(contract)}`);
}

export { formatContractContext };
