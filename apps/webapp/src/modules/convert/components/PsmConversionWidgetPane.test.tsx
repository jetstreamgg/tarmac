import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ConvertIntent, Intent } from '@/lib/enums';
import { PsmConversionWidgetPane } from './PsmConversionWidgetPane';

let mockSearchParams = new URLSearchParams();

const navigateMock = vi.fn();
let mockRouteIntent: Intent = Intent.CONVERT_INTENT;
let mockConvertIntent: ConvertIntent | undefined = ConvertIntent.PSM_INTENT;

const setSearchParamsMock = vi.fn(
  (
    next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams),
    _options?: { replace?: boolean } // eslint-disable-line @typescript-eslint/no-unused-vars
  ) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

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

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

vi.mock('@tanstack/react-router', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [mockSearchParams, setSearchParamsMock],
    useRouteIntent: () => mockRouteIntent,
    useRouteConvertIntent: () => mockConvertIntent
  };
});

describe('PsmConversionWidgetPane', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('source_token=USDC');
    mockRouteIntent = Intent.CONVERT_INTENT;
    mockConvertIntent = ConvertIntent.PSM_INTENT;
    capturedWidgetProps = undefined;
    navigateMock.mockClear();
    setSearchParamsMock.mockClear();
  });

  it('passes URL-derived external state into the widget', () => {
    render(<PsmConversionWidgetPane />);

    expect(capturedWidgetProps?.externalWidgetState).toEqual({
      token: 'USDC'
    });
  });

  it('syncs updated source token back into URL params in psm context', () => {
    render(<PsmConversionWidgetPane />);

    capturedWidgetProps?.onWidgetStateChange({
      originToken: 'USDS',
      originAmount: '25'
    });

    expect(mockSearchParams.get('source_token')).toBe('USDS');
    expect(mockSearchParams.get('input_amount')).toBeNull();
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
  });

  it('does not write duplicate URL state', () => {
    render(<PsmConversionWidgetPane />);

    capturedWidgetProps?.onWidgetStateChange({
      originToken: 'USDC',
      originAmount: '10'
    });

    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('ignores widget state changes outside psm convert context', () => {
    mockConvertIntent = undefined;

    render(<PsmConversionWidgetPane />);

    capturedWidgetProps?.onWidgetStateChange({
      originToken: 'USDS',
      originAmount: '15'
    });

    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('navigates back to the convert landing path', () => {
    render(<PsmConversionWidgetPane />);

    capturedWidgetProps?.onBackToConvert();

    expect(navigateMock).toHaveBeenCalledWith(expect.objectContaining({ to: '/convert' }));
  });
});
