import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BP, useBreakpointIndex } from '../hooks/useBreakpointIndex';

export function GradientShapeCard({
  children,
  colorLeft,
  colorMiddle,
  colorRight,
  className,
  height
}: {
  children: React.ReactNode;
  colorLeft: string;
  colorMiddle: string;
  colorRight: string;
  className?: string;
  height?: number;
}) {
  const { bpi } = useBreakpointIndex();
  const isCompactLayout = bpi < BP.xl;
  return (
    <Card
      className={cn('mb-6 w-full p-0 lg:p-0', className)}
      style={{ height: height ? `${height}px` : undefined }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[20px]">
        <div
          className="absolute h-full w-[110%] xl:w-[90%]"
          style={{
            background: colorLeft,
            clipPath: `polygon(100% 0, ${isCompactLayout ? '45%' : '70%'} 100%, 0 100%, 0 0)`
          }}
        />
        <div
          className="absolute left-[48%] h-full w-[138%] xl:left-[62%] xl:w-[35%]"
          style={{
            background: colorMiddle,
            clipPath: `polygon(100% 0, 10% 100%, 0 100%, ${isCompactLayout ? '45%' : '70%'} 0)`
          }}
        />
        <div
          className="absolute left-[55%] h-full w-[200%] xl:left-[65%] xl:w-[60%]"
          style={{
            background: colorRight,
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 53% 0)'
          }}
        />
        <div className="relative z-10 flex h-full w-full flex-col p-3 py-4 xl:flex-row xl:items-center xl:justify-between xl:px-6">
          {children}
        </div>
      </div>
    </Card>
  );
}
