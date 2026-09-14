/**
 * Design-linked test contract types (redesign QA Gate 4).
 *
 * Each contract ties a user flow to Figma frames and a QA case id so locator
 * breaks surface enough context for repair — without runtime auto-healing.
 */

export type FigmaRef = {
  fileKey: string;
  /** Frame node IDs in `123:456` form */
  frames: string[];
};

export type LocatorSpec = {
  /** Stable primary — must match a data-testid when set */
  testId?: string;
  role?: { type: 'button' | 'link' | 'tab' | 'navigation'; name?: string | RegExp };
  label?: string;
};

export type ContractStep = {
  action: string;
  locator: LocatorSpec;
};

export type TestContract = {
  id: string;
  /** Row in the module QA-CASES.md §2 matrix, e.g. `B-2` */
  qaCase?: string;
  figma: FigmaRef;
  intent: string;
  preconditions: string[];
  steps: ContractStep[];
  /** What proves success — kept as prose; specs implement the oracle */
  oracle: string;
};

/** Sky App UI hi-fi — primary design file for V2 chrome */
export const SKY_APP_UI_FILE = '1aCQfCwuGx90hVwGcD2ZLS';
