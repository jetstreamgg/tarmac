import { ComponentType } from 'react';
import { useLingui } from '@lingui/react';
import { WidgetProvider } from '@/widgets/context/WidgetContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export interface WithWidgetProviderProps {
  onWidgetStateChange?: (data: any) => void;
}

export const withWidgetProvider = <P extends object>(
  WrappedComponent: ComponentType<P>,
  componentName: string
) => {
  return function WithWidgetProviderComponent(props: P & WithWidgetProviderProps) {
    const { onWidgetStateChange, ...componentProps } = props;
    const { i18n } = useLingui();

    return (
      <ErrorBoundary componentName={componentName}>
        <WidgetProvider locale={i18n.locale}>
          <WrappedComponent {...(componentProps as P)} onWidgetStateChange={onWidgetStateChange} />
        </WidgetProvider>
      </ErrorBoundary>
    );
  };
};
