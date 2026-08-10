import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Mobile transaction-card field trio (comps 1222:16771 / 1295:21684): equal-
// column label/value pairs split by centered hairline dividers, shared by the
// stake positions and activity cards (StakePositionsTable / StakeActivityTable).
export function CardField({
  label,
  children,
  testId
}: {
  label: ReactNode;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1" data-testid={testId}>
      <span className="font-graphik text-fgSecondary text-xs leading-[18px]">{label}</span>
      <span className="font-circle text-fgPrimary flex min-h-4 items-center text-sm leading-4 font-medium tracking-[-0.28px]">
        {children}
      </span>
    </div>
  );
}

export function CardFieldRow({ children }: { children: ReactNode }) {
  return <div className="flex w-full items-center gap-4">{children}</div>;
}

export const CardFieldDivider = ({ className }: { className?: string }) => (
  <span className={cn('bg-glassBorder h-9 w-px shrink-0', className)} aria-hidden />
);
