import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer, type Toast } from '@/components/ui/toast';
import { generateId } from '@/lib/utils';
import { isReadOnlyMode, ReadOnlyModeError } from '@/lib/read-only-mode';

interface ToastContextType {
  toast: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((input: Omit<Toast, 'id'>) => {
    // While "View as" is on, failures are almost always blocked writes; many handlers show a generic message.
    const toastData: Omit<Toast, 'id'> =
      input.variant === 'error' && isReadOnlyMode()
        ? { ...input, title: 'Not saved: read-only view', description: new ReadOnlyModeError().message }
        : input;
    const id = generateId();
    setToasts((prev) => [...prev, { ...toastData, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onClose={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
