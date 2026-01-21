import { AlertTriangle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { Info } from '@/modules/icons';

interface ModuleDisclaimerProps {
  dataTestId: string;
  dismissButtonTestId: string;
  type: 'warning' | 'info';
  text: string | React.ReactNode;
  /** Optional tracking for whether disclaimer has been shown (for analytics). */
  isShown?: boolean;
  /** Optional callback when disclaimer is shown. */
  onShow?: () => void;
  /** Callback for dismissal management. */
  onDismiss: () => void;
  /** Current dismissed state. */
  isDismissed: boolean;
}

export function ModuleDisclaimer({
  isShown,
  dataTestId,
  dismissButtonTestId,
  type,
  text,
  onShow,
  onDismiss,
  isDismissed
}: ModuleDisclaimerProps) {
  // Set the disclaimer as shown during render if not already set
  // This avoids race conditions with useEffect
  if (onShow && !isShown) {
    onShow();
  }

  if (isDismissed) return null;

  return (
    <Card className="relative bg-black/65 p-5">
      <button
        onClick={onDismiss}
        className="text-textSecondary hover:text-text absolute top-4 right-4 transition-colors"
        aria-label="Dismiss risk warning"
        data-testid={dismissButtonTestId}
      >
        <X className="h-5 w-5" />
      </button>

      <div className="pr-8">
        <div className="flex gap-3">
          {type === 'warning' ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
          ) : (
            <Info className="text-textEmphasis mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="flex-1">
            {typeof text === 'string' ? (
              <Text variant="medium" dataTestId={dataTestId}>
                {text}
              </Text>
            ) : (
              <div data-testid={dataTestId}>{text}</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
