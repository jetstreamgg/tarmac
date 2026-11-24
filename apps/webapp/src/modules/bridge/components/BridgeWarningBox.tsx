import type { ReactNode } from 'react';
import { Warning } from '@/modules/icons/Warning';

type BridgeWarningBoxProps = {
  title: string;
  children: ReactNode;
  dataTestId: string;
};

/** Amber box with a warning title over its body (Figma 4066:9518). */
export function BridgeWarningBox({ title, children, dataTestId }: BridgeWarningBoxProps) {
  return (
    <div className="bg-statusWarningBg flex flex-col gap-3 rounded-xl p-5" data-testid={dataTestId}>
      <div className="flex items-center gap-2">
        <Warning
          viewBox="0 0 16 16"
          width={16}
          height={16}
          fill="currentColor"
          className="text-fgSystemWarning shrink-0"
        />
        <span
          className="font-circle text-fgPrimary text-sm leading-4 font-medium"
          data-testid={`${dataTestId}-title`}
        >
          {title}
        </span>
      </div>
      <p className="text-fgSecondary text-xs leading-[18px]">{children}</p>
    </div>
  );
}
