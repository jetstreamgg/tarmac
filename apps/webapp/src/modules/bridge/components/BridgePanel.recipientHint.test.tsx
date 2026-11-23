import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RecipientHint } from './BridgePanel';

i18n.load('en', {});
i18n.activate('en');

const hint = (reason: 'contract-unverified' | 'safe-unverified') =>
  render(
    <I18nProvider i18n={i18n}>
      <RecipientHint reason={reason} />
    </I18nProvider>
  ).container.textContent;

describe('RecipientHint', () => {
  afterEach(cleanup);

  // The read that failed may be the source network's, so the hint can't name one.
  it.each(['contract-unverified', 'safe-unverified'] as const)('%s blames no network', reason => {
    expect(hint(reason)).not.toMatch(/network/i);
    expect(hint(reason)).toMatch(/Add a recipient address/);
  });
});
