import { ReactNode } from 'react';
import { Sidebar } from './sidebar';
import { ToastContainer } from '@/components/ui/toast';
import { useToast } from '@/contexts/toast-context';

export function MainLayout({ children }: { children: ReactNode }) {
  const { toasts, dismiss } = useToast();

  return (
    <>
      <Sidebar />
      <main className="h-screen overflow-y-auto ml-0 lg:ml-60 bg-background text-foreground flex flex-col">
        <div className="flex-1 flex flex-col min-h-0 w-full pl-16 pt-4 pr-4 pb-4 sm:pt-6 sm:pr-6 sm:pb-6 sm:pl-16 lg:p-8">
          {children}
        </div>
      </main>
      <ToastContainer toasts={toasts} onClose={dismiss} />
    </>
  );
}
