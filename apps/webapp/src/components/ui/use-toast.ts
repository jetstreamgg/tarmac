import React from 'react';
import { toast as sonnerToast, ExternalToast } from 'sonner';
import { ToastWithCloseButton } from '../toast/ToastWithClose';

export const toast = sonnerToast;

type ToastOptions = ExternalToast;

export function toastWithClose(
  content: React.ReactNode | ((toastId: string | number) => React.ReactNode),
  options?: ToastOptions
) {
  return sonnerToast.custom(toastId => {
    const toastContent = typeof content === 'function' ? content(toastId) : content;
    return React.createElement(ToastWithCloseButton, { toastId }, toastContent);
  }, options);
}
