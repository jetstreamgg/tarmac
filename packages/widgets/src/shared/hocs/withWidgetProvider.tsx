import { ComponentType } from 'react';
import { WidgetProvider } from '@widgets/context/WidgetContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export interface WithWidgetProviderProps {
  locale?: string;
  shouldReset?: boolean;
  onWidgetStateChange?: (data: any) => void;
}

export const withWidgetProvider = <P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName: string
) => {
  return function WithWidgetProviderComponent(props: P & WithWidgetProviderProps) {
    const { locale, shouldReset = false, onWidgetStateChange, ...componentProps } = props;
    const key = shouldReset ? 'reset' : undefined;

    // Handle the conditional onWidgetStateChange logic
    const processedOnWidgetStateChange = shouldReset ? undefined : onWidgetStateChange;

    return (
      <ErrorBoundary componentName={componentName}>
        <WidgetProvider key={key} locale={locale}>
          <WrappedComponent
            key={key}
            {...(componentProps as P)}
            locale={locale}
            onWidgetStateChange={processedOnWidgetStateChange}
          />
        </WidgetProvider>
      </ErrorBoundary>
    );
  };
};
