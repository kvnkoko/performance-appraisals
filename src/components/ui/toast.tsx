import { X } from 'phosphor-react';
import { cn } from '@/lib/utils';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg border shadow-lg transition-all',
        {
          'bg-background border-border': toast.variant === 'default' || !toast.variant,
          'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800': toast.variant === 'success',
          'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800': toast.variant === 'error',
        }
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-1">
            {toast.title && (
              <p
                className={cn('text-sm font-medium', {
                  'text-foreground': toast.variant === 'default' || !toast.variant,
                  'text-green-900 dark:text-green-100': toast.variant === 'success',
                  'text-red-900 dark:text-red-100': toast.variant === 'error',
                })}
              >
                {toast.title}
              </p>
            )}
            {toast.description && (
              <p
                className={cn('text-sm mt-1', {
                  'text-muted-foreground': toast.variant === 'default' || !toast.variant,
                  'text-green-800 dark:text-green-200': toast.variant === 'success',
                  'text-red-800 dark:text-red-200': toast.variant === 'error',
                })}
              >
                {toast.description}
              </p>
            )}
          </div>
          <button
            onClick={() => onClose(toast.id)}
            className="ml-4 inline-flex text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-4 p-4 sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}
