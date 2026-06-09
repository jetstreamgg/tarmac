import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PsmConversionWidgetPane } from './PsmConversionWidgetPane';

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (
    next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams),
    _options?: { replace?: boolean } // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

const setSelectedConvertOptionMock = vi.fn();

let capturedWidgetProps: Record<string, any> | undefined;

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    PsmConversionWidget: (props: Record<string, any>) => {
      capturedWidgetProps = props;
      return <div data-testid="psm-conversion-widget" />;
    }
  };
});

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({
    setSelectedConvertOption: setSelectedConvertOptionMock
  })
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, setSearchParamsMock]
}));

describe('PsmConversionWidgetPane', () => {
  const sharedProps = {
    rightHeaderComponent: <div />
  };

  beforeEach(() => {
    mockSearchParams = new URLSearchParams('widget=convert&convert_module=psm&source_token=USDC');
    capturedWidgetProps = undefined;
    setSearchParamsMock.mockClear();
    setSelectedConvertOptionMock.mockClear();
  });

  it('passes URL-derived external state into the widget', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    expect(capturedWidgetProps?.externalWidgetState).toEqual({
      token: 'USDC'
    });
  });

  it('syncs updated source token back into URL params in psm context', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onWidgetStateChange({
      originToken: 'USDS',
      originAmount: '25'
    });

    expect(mockSearchParams.get('source_token')).toBe('USDS');
    expect(mockSearchParams.get('input_amount')).toBeNull();
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('does not write duplicate URL state', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onWidgetStateChange({
      originToken: 'USDC',
      originAmount: '10'
    });

    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('ignores widget state changes outside psm convert context', () => {
    mockSearchParams = new URLSearchParams('widget=convert&source_token=USDC');

    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onWidgetStateChange({
      originToken: 'USDS',
      originAmount: '15'
    });

    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('clears convert_module when navigating back to convert landing', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onBackToConvert();

    expect(mockSearchParams.get('convert_module')).toBeNull();
    expect(setSelectedConvertOptionMock).toHaveBeenCalledWith(undefined);
  });
});
