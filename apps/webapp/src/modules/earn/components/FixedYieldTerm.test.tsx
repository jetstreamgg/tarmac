import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FixedYieldTerm } from './FixedYieldTerm';

i18n.load('en', {});
i18n.activate('en');

const renderTerm = (days?: number) =>
  render(
    <I18nProvider i18n={i18n}>
      <p data-testid="blurb">
        <Trans>
          Fixed yield markets let you supply USDS and walk away with a guaranteed return at the market
          maturity.
        </Trans>{' '}
        <FixedYieldTerm rate="5.20%" days={days} />
      </p>
    </I18nProvider>
  );

const blurb = () => screen.getByTestId('blurb').textContent;

afterEach(cleanup);

describe('FixedYieldTerm', () => {
  it('states the term in days when the market is more than a day out', () => {
    renderTerm(49);
    expect(blurb()).toContain('Fix your yield at 5.20% APY for the next 49 days.');
  });

  it('never renders "1 days"', () => {
    renderTerm(1);
    expect(blurb()).toContain('Fix your yield at 5.20% APY for one more day.');
    expect(blurb()).not.toContain('1 days');
  });

  // The count floors against a UTC-anchored expiry, so the last stretch lands on
  // 0 — it must not read "0 days", nor claim a calendar day the viewer may not
  // share.
  it('reads "less than a day" on the final stretch, not "0 days" or "today"', () => {
    renderTerm(0);
    expect(blurb()).toContain('This market matures in less than a day.');
    expect(blurb()).not.toContain('0 days');
    expect(blurb()).not.toContain('today');
  });

  it('drops the sentence when no maturity is known', () => {
    renderTerm(undefined);
    expect(blurb()).not.toContain('Fix your yield');
    expect(blurb()).not.toContain('days');
  });

  // The blurb is one <Trans> joined to this component; the join must not
  // swallow or double the space between the sentences.
  it('keeps exactly one space between the two sentences', () => {
    renderTerm(49);
    expect(blurb()).toContain('at the market maturity. Fix your yield');
  });
});
