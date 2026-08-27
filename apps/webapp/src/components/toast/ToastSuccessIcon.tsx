import { Check } from 'lucide-react';

/**
 * The design-system toast's success disc (Figma Components/Toast 5075:17183):
 * a 34px statusSuccessBg circle behind a bare 16px check, ringed in
 * statusSuccessBorder. Shared by sonner's built-in `success` variant and the
 * custom toasts that draw their own icon, so the two can't drift.
 */
export function ToastSuccessIcon() {
  return (
    <span className="border-statusSuccessBorder bg-statusSuccessBg text-statusSuccess flex items-center justify-center rounded-full border p-2">
      <Check size={16} />
    </span>
  );
}
