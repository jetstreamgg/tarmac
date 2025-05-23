import { Card, CardHeader, CardContent, CardFooter } from '@widgets/components/ui/card';
import { HStack } from '@widgets/shared/components/ui/layout/HStack';
import { cn } from '@widgets/lib/utils';
import { JSX } from 'react';

export const StatsOverviewCardCore = ({
  headerLeftContent,
  headerRightContent,
  content,
  footerContent,
  onClick,
  className
}: {
  headerLeftContent: JSX.Element;
  headerRightContent: JSX.Element;
  content: JSX.Element;
  footerContent?: JSX.Element;
  onClick?: (any?: any) => void;
  className?: string;
}) => {
  return (
    <Card variant="pool" onClick={onClick} className={cn('mb-3 mt-4', className)}>
      <CardHeader>
        <HStack className="w-full justify-between">
          {headerLeftContent}
          {headerRightContent}
        </HStack>
      </CardHeader>
      <CardContent>{content}</CardContent>
      {footerContent && <CardFooter className="mt-0!">{footerContent}</CardFooter>}
    </Card>
  );
};
