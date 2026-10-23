/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CctpConvertReview } from './CctpConvertReview';

vi.mock('@/modules/ui/hooks/useModalFeeCell', () => ({
  useModalFeeCell: () => ({ fee: { formatted: '$0.01' }, state: {}, loading: false })
}));
vi.mock('@/modules/ui/hooks/useNetworkName', () => ({
  useNetworkName: (chainId: number) => (chainId === 1 ? 'Ethereum' : 'Base')
}));
vi.mock('wagmi', () => ({ useChainId: () => 1 }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));
vi.mock('@/modules/ui/hooks/useChainImage', () => ({ useChainImage: () => undefined }));

const USDC = (amount: number) => BigInt(amount) * 10n ** 6n;

// The review of a convert after a CCTP claim (Figma 94, 95): USDC to USDS at 1:1 on Ethereum.
describe('CctpConvertReview', () => {
  beforeAll(() => {
    i18n.loadAndActivate({ locale: 'en', messages: {} });
  });

  const renderReview = (amount: bigint) =>
    render(
      <I18nProvider i18n={i18n}>
        <CctpConvertReview amount={amount} bridged={USDC(10_000)} chainId={1} calls={[]} isBatch={false} />
      </I18nProvider>
    );

  it('shows the USDC it sells and the USDS it gets, on Ethereum, with no fee or slippage', () => {
    renderReview(USDC(10_000));
    expect(screen.getByTestId('convert-modal-from-amount').textContent).toBe('10,000.00');
    expect(screen.getByTestId('convert-modal-to-amount').textContent).toBe('10,000.00');
    const review = screen.getByTestId('convert-modal-review').textContent;
    expect(review).toContain('Ethereum');
    expect(review).toContain('0.00%');
    expect(review).toContain('$0.00');
    expect(review).toContain('$0.01');
  });

  it('warns nothing when it converts all the bridged USDC', () => {
    renderReview(USDC(10_000));
    expect(screen.queryByTestId('cctp-convert-partial-warning')).toBeNull();
  });

  it('says it converts only what the wallet holds when that is less than the bridge', () => {
    renderReview(USDC(5_000));
    expect(screen.getByTestId('convert-modal-from-amount').textContent).toBe('5,000.00');
    expect(screen.getByTestId('cctp-convert-partial-warning-title').textContent).toBe(
      'Converting 5,000.00 USDC'
    );
    expect(screen.getByTestId('cctp-convert-partial-warning').textContent).toContain(
      "This wallet holds 5,000.00 of the 10,000.00 USDC from your bridge, so we'll convert what's here to USDS at 1:1. If you move the rest back, you can convert it later from the Swap tab."
    );
  });
});
