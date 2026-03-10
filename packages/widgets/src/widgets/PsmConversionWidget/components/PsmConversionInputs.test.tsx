import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@lingui/core';
import { PsmConversionInputs } from './PsmConversionInputs';

const tokenInputMock = vi.fn((props: Record<string, any>) => (
  <div data-testid={props.dataTestId}>
    <span>{props.label}</span>
    <span>{props.token.symbol}</span>
    {props.error && <span>{props.error}</span>}
    {props.limitText && <span>{props.limitText}</span>}
    <span>{props.showPercentageButtons ? 'percentages-on' : 'percentages-off'}</span>
  </div>
));

vi.mock('@widgets/shared/components/ui/token/TokenInput', () => ({
  TokenInput: (props: Record<string, any>) => tokenInputMock(props)
}));

vi.mock('wagmi', () => ({
  useChainId: () => 1
}));

vi.mock('@jetstreamgg/sky-hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-hooks')>();
  return {
    ...actual,
    getTokenDecimals: (token: { symbol: string }) => (token.symbol === 'USDC' ? 6 : 18)
  };
});

describe('PsmConversionInputs', () => {
  const originToken = { symbol: 'USDC', name: 'USD Coin' } as any;
  const targetToken = { symbol: 'USDS', name: 'USDS' } as any;
  const onOriginAmountChange = vi.fn();
  const onSwitchDirection = vi.fn();

  beforeEach(() => {
    i18n.load('en', {});
    i18n.activate('en');
    tokenInputMock.mockClear();
    onOriginAmountChange.mockClear();
    onSwitchDirection.mockClear();
  });

  it('renders origin and target inputs with the expected props', () => {
    render(
      <PsmConversionInputs
        originToken={originToken}
        targetToken={targetToken}
        originAmount={1_250_000n}
        targetAmount={1_250_000_000_000_000_000n}
        originBalance={2_000_000n}
        targetBalance={0n}
        isBalanceError
        isConnectedAndEnabled
        onOriginAmountChange={onOriginAmountChange}
        onSwitchDirection={onSwitchDirection}
      />
    );

    expect(screen.getByTestId('psm-conversion-origin').textContent).toContain('Enter the amount to convert');
    expect(screen.getByTestId('psm-conversion-origin').textContent).toContain('USDC');
    expect(screen.getByTestId('psm-conversion-origin').textContent).toContain('Insufficient funds');
    expect(screen.getByTestId('psm-conversion-origin').textContent).toContain('percentages-on');

    expect(screen.getByTestId('psm-conversion-target').textContent).toContain('You will receive');
    expect(screen.getByTestId('psm-conversion-target').textContent).toContain('USDS');
    expect(screen.getByTestId('psm-conversion-target').textContent).toContain('1.25 USDS');
    expect(screen.getByTestId('psm-conversion-target').textContent).toContain('percentages-off');
  });

  it('calls onSwitchDirection when the switch button is clicked', () => {
    render(
      <PsmConversionInputs
        originToken={originToken}
        targetToken={targetToken}
        originAmount={0n}
        targetAmount={0n}
        isBalanceError={false}
        isConnectedAndEnabled={false}
        onOriginAmountChange={onOriginAmountChange}
        onSwitchDirection={onSwitchDirection}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /switch conversion direction/i }));

    expect(onSwitchDirection).toHaveBeenCalledTimes(1);
  });
});
