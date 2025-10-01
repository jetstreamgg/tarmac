import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BP, useBreakpointIndex } from '../hooks/useBreakpointIndex';

export function GradientShapeCard({
  children,
  colorLeft,
  colorMiddle,
  colorRight,
  className
}: {
  children: React.ReactNode;
  colorLeft: string;
  colorMiddle: string;
  colorRight: string;
  className?: string;
}) {
  const { bpi } = useBreakpointIndex();
  const isMobileOrTablet = bpi < BP.lg;
  return (
    <Card className={cn('mb-6 w-full p-0 lg:p-0', className)}>
      <div className="relative h-full w-full overflow-hidden rounded-[20px]">
        <div
          className="absolute h-full w-[110%] lg:w-[90%]"
          style={{
            background: colorLeft,
            clipPath: `polygon(100% 0, ${isMobileOrTablet ? '45%' : '65%'} 100%, 0 100%, 0 0)`
          }}
        />
        <div
          className="absolute left-[48%] h-full w-[138%] lg:left-[57%] lg:w-[35%]"
          style={{
            background: colorMiddle,
            clipPath: `polygon(100% 0, 10% 100%, 0 100%, ${isMobileOrTablet ? '45%' : '65%'} 0)`
          }}
        />
        <div
          className="absolute left-[55%] h-full w-[200%] lg:left-[60%] lg:w-[60%]"
          style={{
            background: colorRight,
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 53% 0)'
          }}
        />
        <div className="relative z-10 flex h-full w-full flex-col p-3 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          {children}
        </div>
      </div>
    </Card>
  );
}
