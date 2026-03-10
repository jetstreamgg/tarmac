import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { PsmConversionWidgetPane } from './PsmConversionWidgetPane';

let mockSearchParams = new URLSearchParams();

const setSearchParamsMock = vi.fn(
  (
    next:
      | URLSearchParams
      | ((params: URLSearchParams) => URLSearchParams),
    _options?: { replace?: boolean }
  ) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

const setSelectedConvertOptionMock = vi.fn();
const setBatchEnabledMock = vi.fn();
const onAnalyticsEventMock = vi.fn();
const setShouldDisableActionButtonsMock = vi.fn();

let capturedWidgetProps: Record<string, any> | undefined;

vi.mock('@jetstreamgg/sky-widgets', () => ({
  TxStatus: {
    INITIALIZED: 'initialized',
    IDLE: 'idle'
  },
  PsmConversionWidget: (props: Record<string, any>) => {
    capturedWidgetProps = props;
    return <div data-testid="psm-conversion-widget" />;
  }
}));

vi.mock('@/modules/config/hooks/useConfigContext', () => ({
  useConfigContext: () => ({
    setSelectedConvertOption: setSelectedConvertOptionMock
  })
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, setBatchEnabledMock]
}));

vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: () => onAnalyticsEventMock
}));

vi.mock('@/modules/chat/context/ChatContext', () => ({
  useChatContext: () => ({
    setShouldDisableActionButtons: setShouldDisableActionButtonsMock
  })
}));

vi.mock('wagmi', () => ({
  useChainId: () => 1
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, setSearchParamsMock]
}));

describe('PsmConversionWidgetPane', () => {
  const sharedProps = {
    onConnect: vi.fn(),
    addRecentTransaction: vi.fn(),
    locale: 'en',
    rightHeaderComponent: <div />,
    onNotification: vi.fn(),
    enabled: true,
    referralCode: 0,
    shouldReset: false,
    legalBatchTxUrl: 'https://example.com/legal'
  };

  beforeEach(() => {
    mockSearchParams = new URLSearchParams('widget=convert&convert_module=psm&source_token=USDC&input_amount=10');
    capturedWidgetProps = undefined;
    setSearchParamsMock.mockClear();
    setSelectedConvertOptionMock.mockClear();
    setBatchEnabledMock.mockClear();
    onAnalyticsEventMock.mockClear();
    setShouldDisableActionButtonsMock.mockClear();
  });

  it('passes URL-derived external state into the widget', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    expect(capturedWidgetProps?.externalWidgetState).toEqual({
      amount: '10',
      token: 'USDC'
    });
    expect(capturedWidgetProps?.batchEnabled).toBe(true);
    expect(capturedWidgetProps?.setBatchEnabled).toBe(setBatchEnabledMock);
    expect(capturedWidgetProps?.onAnalyticsEvent).toBe(onAnalyticsEventMock);
  });

  it('syncs updated widget state back into URL params in psm context', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onWidgetStateChange({
      txStatus: 'initialized',
      originToken: 'USDS',
      originAmount: '25'
    });

    expect(setShouldDisableActionButtonsMock).toHaveBeenCalledWith(true);
    expect(mockSearchParams.get('source_token')).toBe('USDS');
    expect(mockSearchParams.get('input_amount')).toBe('25');
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('does not write duplicate URL state', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onWidgetStateChange({
      txStatus: 'idle',
      originToken: 'USDC',
      originAmount: '10'
    });

    expect(setSearchParamsMock).not.toHaveBeenCalled();
    expect(setShouldDisableActionButtonsMock).toHaveBeenCalledWith(false);
  });

  it('ignores widget state changes outside psm convert context', () => {
    mockSearchParams = new URLSearchParams('widget=convert&source_token=USDC');

    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onWidgetStateChange({
      txStatus: 'initialized',
      originToken: 'USDS',
      originAmount: '15'
    });

    expect(setSearchParamsMock).not.toHaveBeenCalled();
    expect(setShouldDisableActionButtonsMock).not.toHaveBeenCalled();
  });

  it('clears convert_module when navigating back to convert landing', () => {
    render(<PsmConversionWidgetPane {...sharedProps} />);

    capturedWidgetProps?.onBackToConvert();

    expect(mockSearchParams.get('convert_module')).toBeNull();
    expect(setSelectedConvertOptionMock).toHaveBeenCalledWith(undefined);
  });
});
