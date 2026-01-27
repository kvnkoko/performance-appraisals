import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { ToastContainer } from '@/components/ui/toast';
import { useToast } from '@/contexts/toast-context';

export function MainLayout({ children }: { children: ReactNode }) {
  const { toasts, dismiss } = useToast();

  return (
    <>
      <Sidebar />
      <main className="h-screen overflow-y-auto ml-0 lg:ml-60 bg-background text-foreground">
        <div className="h-full w-full min-h-0 p-4 sm:p-5 lg:p-6">
          {children}
        </div>
      </main>
      <ToastContainer toasts={toasts} onClose={dismiss} />
    </>
  );
}
