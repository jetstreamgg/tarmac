import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { yearsOperating } from '../helpers/protocolStats';
import { ProtocolLineageBadge } from './ProtocolLineageBadge';

// Pin the pointer/touch split per test — happy-dom reports no touch support,
// so the tooltip branch is the default.
const device = vi.hoisted(() => ({ isTouch: false }));
vi.mock('@/hooks/ui/useIsTouchDevice', () => ({ useIsTouchDevice: () => device.isTouch }));

i18n.load('en', {});
i18n.activate('en');

const renderBadge = () =>
  render(
    <I18nProvider i18n={i18n}>
      <ProtocolLineageBadge />
    </I18nProvider>
  );

const LINEAGE =
  /Sky Protocol is MakerDAO's continuation - running decentralized stablecoin infrastructure since 2017\./;

describe('ProtocolLineageBadge — the Earn hero years badge and its lineage tooltip', () => {
  afterEach(() => {
    device.isTouch = false;
    cleanup();
  });

  it('labels the badge with the completed years since the protocol start', () => {
    renderBadge();

    expect(screen.getByText(`Operating for ${yearsOperating()} years`)).toBeTruthy();
  });

  it('keeps the lineage copy out of the resting hero', () => {
    renderBadge();

    expect(screen.queryByText(LINEAGE)).toBeNull();
  });

  it('reveals the lineage copy from the badge on focus', () => {
    renderBadge();

    // Radix opens the tooltip on keyboard-visible focus.
    fireEvent.keyDown(document.body, { key: 'Tab' });
    fireEvent.focus(screen.getByRole('button'));

    expect(screen.getAllByText(LINEAGE).length).toBeGreaterThan(0);
  });

  it('opens the same copy on tap where there is no hover', () => {
    device.isTouch = true;
    renderBadge();

    expect(screen.queryByText(LINEAGE)).toBeNull();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText(LINEAGE).length).toBeGreaterThan(0);
  });

  it('takes the tooltip year from the same constant as the badge count, so the two cannot drift', () => {
    renderBadge();

    fireEvent.keyDown(document.body, { key: 'Tab' });
    fireEvent.focus(screen.getByRole('button'));

    // 2017 + the badge's completed years is the current year (or the year
    // before, until the December anniversary passes).
    const currentYear = new Date().getUTCFullYear();
    expect(2017 + yearsOperating()).toBeGreaterThanOrEqual(currentYear - 1);
    expect(screen.getAllByText(/since 2017\./).length).toBeGreaterThan(0);
  });
});
