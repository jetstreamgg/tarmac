import { AlertTriangle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Text } from '@/modules/layout/components/Typography';
import { useState } from 'react';
import { Info } from '@/modules/icons';

interface ModuleDisclaimerProps {
  moduleKey: string;
  isShown: boolean;
  dataTestId: string;
  dismissButtonTestId: string;
  type: 'warning' | 'info';
  text: string | React.ReactNode;
  setIsShown: (isShown: boolean) => void;
}

export function ModuleDisclaimer({
  moduleKey,
  isShown,
  dataTestId,
  dismissButtonTestId,
  type,
  text,
  setIsShown
}: ModuleDisclaimerProps) {
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(
    window.localStorage.getItem(moduleKey) === 'true'
  );

  // Set the disclaimer as shown during render if not already set
  // This avoids race conditions with useEffect
  if (!isShown) {
    setIsShown(true);
  }

  const onDismissDisclaimer = () => {
    window.localStorage.setItem(moduleKey, 'true');
    setIsShown(true);
    setDisclaimerDismissed(true);
  };

  if (disclaimerDismissed) return null;

  return (
    <Card className="relative bg-black/65 p-5">
      <button
        onClick={onDismissDisclaimer}
        className="text-textSecondary hover:text-text absolute right-4 top-4 transition-colors"
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
