/**
 * @vitest-environment happy-dom
 */
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { TxStatus } from '@/modules/ui/lib/txStatus';
import { OpenTransactionMessage } from './OpenTransactionMessage';

const tx = vi.hoisted(() => ({ txStatus: 'idle' as string }));
vi.mock('@/modules/ui/context/TransactionContext', () => ({ useTransaction: () => tx }));

beforeAll(() => i18n.loadAndActivate({ locale: 'en', messages: {} }));

const text = () =>
  render(
    <I18nProvider i18n={i18n}>
      <OpenTransactionMessage />
    </I18nProvider>
  ).container.textContent;

it('says a running transaction is in progress, and a failed one failed', () => {
  for (const status of [TxStatus.INITIALIZED, TxStatus.LOADING]) {
    tx.txStatus = status;
    expect(text()).toBe('A transaction is in progress. Open it to continue.');
  }
  tx.txStatus = TxStatus.ERROR;
  expect(text()).toBe('A transaction failed. Open it to try again or close it.');
});
