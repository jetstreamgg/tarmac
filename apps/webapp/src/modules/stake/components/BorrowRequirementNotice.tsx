import { ReactNode } from 'react';
import { Info } from 'lucide-react';

/**
 * Min-collateral / min-borrow warning callout (Figma 2376:226246 — a
 * hand-rolled frame, no matching DS Alert component). Neutral lavender
 * border (colors/border/border-secondary), no fill; only the icon stays
 * the semantic warning orange. Shared by the takeover borrow card and the
 * manage-position borrow card, which both surface the same "more SKY
 * needed to borrow" state.
 */
export function BorrowRequirementNotice({
  dataTestId,
  title,
  children
}: {
  dataTestId: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-testid={dataTestId}
      className="border-glassBorder flex flex-col gap-2 rounded-2xl border px-5 py-4"
    >
      <div className="flex items-center gap-2">
        {/* fgSystemWarning is colors/fg/fg-system-warning-primary — a distinct
            DS variable from components/status/fg-warning (statusWarning). */}
        <Info className="text-fgSystemWarning h-4 w-4 shrink-0" strokeWidth={1.33} aria-hidden />
        <span className="text-fgPrimary font-circle text-base leading-[18px] font-medium tracking-[-0.32px]">
          {title}
        </span>
      </div>
      <p className="text-fgSecondary text-xs leading-[18px]">{children}</p>
    </div>
  );
}
