import { ComponentType } from 'react';
import { useLingui } from '@lingui/react';
import { WidgetProvider } from '@/widgets/context/WidgetContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export interface WithWidgetProviderProps {
  shouldReset?: boolean;
  onWidgetStateChange?: (data: any) => void;
}

export const withWidgetProvider = <P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName: string
) => {
  return function WithWidgetProviderComponent(props: P & WithWidgetProviderProps) {
    const { shouldReset = false, onWidgetStateChange, ...componentProps } = props;
    const { i18n } = useLingui();
    const key = shouldReset ? 'reset' : undefined;

    // Handle the conditional onWidgetStateChange logic
    const processedOnWidgetStateChange = shouldReset ? undefined : onWidgetStateChange;

    return (
      <ErrorBoundary componentName={componentName}>
        <WidgetProvider key={key} locale={i18n.locale}>
          <WrappedComponent
            key={key}
            {...(componentProps as P)}
            onWidgetStateChange={processedOnWidgetStateChange}
          />
        </WidgetProvider>
      </ErrorBoundary>
    );
  };
};
