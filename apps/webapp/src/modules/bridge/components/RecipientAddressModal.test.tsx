/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { stubDialogExitAnimation } from '@/test/stubDialogExitAnimation';
import { RecipientAddressModal } from './RecipientAddressModal';

const SAVED = `0x${'22'.repeat(20)}`;

function renderModal(recipient?: string) {
  const onSave = vi.fn();
  render(
    <I18nProvider i18n={i18n}>
      <RecipientAddressModal
        open
        onOpenChange={() => {}}
        recipient={recipient}
        family="evm"
        onSave={onSave}
      />
    </I18nProvider>
  );
  return onSave;
}

const save = () => screen.getByTestId('bridge-recipient-save') as HTMLButtonElement;
const input = () => screen.getByTestId('bridge-recipient-input') as HTMLInputElement;

describe('RecipientAddressModal Save', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });
  afterEach(cleanup);

  it('stays disabled while nothing is saved and nothing is typed', () => {
    renderModal();
    expect(save().disabled).toBe(true);
  });

  it('saves a typed address', () => {
    const onSave = renderModal();
    fireEvent.change(input(), { target: { value: SAVED } });
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledWith(SAVED);
  });

  it('can still clear a saved recipient, so the funds go back to the connected wallet', () => {
    const onSave = renderModal(SAVED);
    fireEvent.click(screen.getByTestId('bridge-recipient-clear'));
    expect(save().disabled).toBe(false);
    fireEvent.click(save());
    expect(onSave).toHaveBeenCalledWith(undefined);
  });

  it('keeps Save disabled on an invalid address', () => {
    renderModal();
    fireEvent.change(input(), { target: { value: 'not-an-address' } });
    expect(save().disabled).toBe(true);
  });
});

describe('RecipientAddressModal open and close', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });
  afterEach(cleanup);

  const modal = (open: boolean) => (
    <I18nProvider i18n={i18n}>
      <RecipientAddressModal
        open={open}
        onOpenChange={() => {}}
        recipient={SAVED}
        family="evm"
        onSave={() => {}}
      />
    </I18nProvider>
  );

  it('keeps the form in the closing modal until its exit animation ends', () => {
    stubDialogExitAnimation();
    const { rerender } = render(modal(true));
    rerender(modal(false));
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('data-state')).toBe('closed');
    expect(input()).toBeTruthy();
  });

  it('drops an abandoned draft, reopening on the saved value', () => {
    const { rerender } = render(modal(true));
    fireEvent.change(input(), { target: { value: 'abandoned' } });
    rerender(modal(false));
    expect(screen.queryByTestId('bridge-recipient-input')).toBeNull();
    rerender(modal(true));
    expect(input().value).toBe(SAVED);
  });
});
