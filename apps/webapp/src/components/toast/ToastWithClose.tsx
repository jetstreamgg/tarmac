import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { X } from 'lucide-react';

interface ToastWithCloseButtonProps {
  toastId: string | number;
  children?: React.ReactNode;
}

// Component that renders toast content with a close button properly positioned
export const ToastWithCloseButton: React.FC<ToastWithCloseButtonProps> = ({ toastId, children }) => {
  return (
    <>
      {/* Close button positioned absolutely in the toast container */}
      <button
        onClick={() => sonnerToast.dismiss(toastId)}
        className="text-text/50 hover:text-text absolute right-3 top-3 z-10 rounded-md p-1.5 transition-colors"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
      <div>{children}</div>
    </>
  );
};
