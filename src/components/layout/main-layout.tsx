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
        <div className="min-h-full w-full p-4 sm:p-6 lg:p-8 pb-12 sm:pb-16 lg:pb-20">
          {children}
        </div>
      </main>
      <ToastContainer toasts={toasts} onClose={dismiss} />
    </>
  );
}
