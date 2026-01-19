import { Warning, X } from 'phosphor-react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      bg: 'bg-red-500/10',
      button: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700',
    },
    warning: {
      icon: 'text-amber-500',
      bg: 'bg-amber-500/10',
      button: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700',
    },
    info: {
      icon: 'text-blue-500',
      bg: 'bg-blue-500/10',
      button: 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md shadow-2xl border-2 animate-in zoom-in-95 duration-200">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${styles.bg}`}>
              <Warning size={24} weight="duotone" className={styles.icon} />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{title}</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X size={18} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <CardDescription className="text-base mb-6">{description}</CardDescription>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-11"
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className={`flex-1 h-11 text-white ${styles.button} shadow-lg`}
              disabled={loading}
            >
              {loading ? 'Processing...' : confirmText}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
