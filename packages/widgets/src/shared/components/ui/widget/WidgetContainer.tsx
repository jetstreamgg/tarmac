import { Card, CardHeader, CardFooter, CardContent } from '@widgets/components/ui/card';
import { forwardRef } from 'react';
import { cn } from '@widgets/lib/utils';

interface WidgetContainerProps {
  header?: React.ReactElement;
  subHeader?: React.ReactElement;
  rightHeader?: React.ReactElement;
  footer?: React.ReactElement;
  children?: React.ReactNode;
  contentClassname?: string;
  containerClassName?: string;
}

export const WidgetContainer = forwardRef<HTMLDivElement, WidgetContainerProps>(
  ({ header, subHeader, rightHeader, footer, children, contentClassname, containerClassName }, ref) => {
    return (
      <Card
        variant="widget"
        data-testid="widget-container"
        className={cn('relative h-full', containerClassName)}
      >
        <div ref={ref} className="scrollbar-thin-always overflow-y-auto">
          <CardHeader className="space-y-0">
            <div className="flex w-full items-start justify-between">
              <div className="flex-1">{header}</div>
              {rightHeader && <div className="ml-4">{rightHeader}</div>}
            </div>
          </CardHeader>
          {subHeader && <div className="pb-4 pt-2">{subHeader}</div>}
          <CardContent
            className={cn('mb-0 grow p-0 pb-6 md:pr-0', subHeader ? 'mt-4' : 'mt-6', contentClassname)}
          >
            {children}
          </CardContent>
        </div>
        <CardFooter className="sticky bottom-0 mt-auto p-0 pr-2.5">{footer}</CardFooter>
      </Card>
    );
  }
);
