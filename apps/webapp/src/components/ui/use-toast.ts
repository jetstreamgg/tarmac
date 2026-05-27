import React from 'react';
import { toast as sonnerToast, ExternalToast } from 'sonner';
import { ToastWithCloseButton } from '../toast/ToastWithClose';

export const toast = sonnerToast;

export type ToastOptions = ExternalToast;

export function useToast() {
  return {
    toast: sonnerToast,
    dismiss: sonnerToast.dismiss,
    success: sonnerToast.success,
    error: sonnerToast.error,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    message: sonnerToast.message
  };
}

export function toastWithClose(
  content: React.ReactNode | ((toastId: string | number) => React.ReactNode),
  options?: ToastOptions
) {
  return sonnerToast.custom(toastId => {
    const toastContent = typeof content === 'function' ? content(toastId) : content;
    return React.createElement(ToastWithCloseButton, { toastId }, toastContent);
  }, options);
}
