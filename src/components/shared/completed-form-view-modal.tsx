import { createPortal } from 'react-dom';
import { X, FileText, User, Calendar, ChartBar } from 'phosphor-react';
import { useApp } from '@/contexts/app-context';
import { formatDate } from '@/lib/utils';
import { RATING_LABELS } from '@/types';
import type { Appraisal, Template, Category, CategoryItem } from '@/types';

interface CompletedFormViewModalProps {
  open: boolean;
  onClose: () => void;
  appraisalId: string | null;
}

function getItemsFromTemplate(template: Template): { id: string; text: string; type: string; categoryName: string }[] {
  const items: { id: string; text: string; type: string; categoryName: string }[] = [];
  if (template.categories?.length) {
    template.categories.forEach((cat: Category) => {
      (cat.items || []).forEach((item: CategoryItem) => {
        items.push({
          id: item.id,
          text: item.text,
          type: item.type,
          categoryName: cat.categoryName,
        });
      });
    });
  } else if (template.questions?.length) {
    template.questions.forEach((q: any) => {
      items.push({
        id: q.id,
        text: q.text,
        type: q.type,
        categoryName: q.categoryName || 'General',
      });
    });
  }
  return items;
}

function formatResponseValue(value: string | number, type: string): string {
  if (type === 'rating-1-5') {
    const n = Number(value);
    const label = RATING_LABELS[n as keyof typeof RATING_LABELS];
    return label ? `${n} – ${label.label}` : String(value);
  }
  return String(value ?? '—');
}

export function CompletedFormViewModal({ open, onClose, appraisalId }: CompletedFormViewModalProps) {
  const { appraisals, templates, employees } = useApp();

  if (!open) return null;

  const appraisal: Appraisal | undefined = appraisalId
    ? appraisals.find((a) => a.id === appraisalId)
    : undefined;
  const template: Template | undefined = appraisal
    ? templates.find((t) => t.id === appraisal.templateId)
    : undefined;
  const appraiserName = appraisal
    ? employees.find((e) => e.id === appraisal.appraiserId)?.name ?? appraisal.appraiserId
    : '';
  const employeeName = appraisal
    ? employees.find((e) => e.id === appraisal.employeeId)?.name ?? appraisal.employeeId
    : '';

  const responseByQ = (appraisal?.responses ?? []).reduce(
    (acc, r) => {
      acc[r.questionId] = r.value;
      return acc;
    },
    {} as Record<string, string | number>
  );

  const items = template ? getItemsFromTemplate(template) : [];
  const byCategory = items.reduce(
    (acc, item) => {
      if (!acc[item.categoryName]) acc[item.categoryName] = [];
      acc[item.categoryName].push(item);
      return acc;
    },
    {} as Record<string, typeof items>
  );

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
      aria-label="View completed form"
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-foreground truncate">
            {appraisal && template ? (
              <>
                <FileText size={20} weight="duotone" className="inline-block mr-2 align-middle text-muted-foreground" />
                {template.name}
              </>
            ) : (
              'Completed form'
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={20} weight="duotone" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!appraisal ? (
            <p className="text-muted-foreground text-sm">Form not found.</p>
          ) : !template ? (
            <p className="text-muted-foreground text-sm">Template not found.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User size={16} weight="duotone" />
                  <span>{appraiserName} → {employeeName}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar size={16} weight="duotone" />
                  <span>{appraisal.reviewPeriodName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChartBar size={16} weight="duotone" className="text-emerald-600" />
                  <span className="font-medium text-foreground">
                    Score: {appraisal.score} / {appraisal.maxScore}
                  </span>
                </div>
                <div className="text-muted-foreground">
                  Submitted {appraisal.completedAt ? formatDate(appraisal.completedAt) : '—'}
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-4">
                {Object.entries(byCategory).map(([categoryName, categoryItems]) => (
                  <div key={categoryName} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide text-muted-foreground">
                      {categoryName}
                    </h3>
                    <div className="space-y-2 pl-2 border-l-2 border-border/60">
                      {categoryItems.map((item) => (
                        <div key={item.id} className="py-1.5 px-2 text-sm">
                          <p className="text-muted-foreground text-xs leading-snug mb-0.5">{item.text}</p>
                          <p className="font-medium text-foreground">
                            {formatResponseValue(responseByQ[item.id] ?? '', item.type)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
